import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SignJWT, importPKCS8 } from "jose";
import { PKPass } from "passkit-generator";
import { loadManagedBookingGroup } from "@/lib/manage-bookings";
import { privateJson, publicError, siteUrl } from "@/lib/security";
import { clock, fullDate } from "@/lib/booking-data";
export async function GET(req: Request) {
  try {
    const apple = Boolean(
      process.env.APPLE_PASS_CERT &&
      process.env.APPLE_PASS_KEY &&
      process.env.APPLE_WWDR_CERT &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_TYPE_ID,
    );
    const google = Boolean(
      process.env.GOOGLE_WALLET_PRIVATE_KEY &&
      process.env.GOOGLE_WALLET_EMAIL &&
      process.env.GOOGLE_WALLET_CLASS_ID,
    );
    const q = new URL(req.url).searchParams;
    if (!q.get("provider")) return privateJson({ apple, google });
    const token = q.get("token") || "";
    const g = await loadManagedBookingGroup(token);
    const b = g?.appointments.find(
      (b) => b.id === q.get("booking") && b.status === "booked",
    );
    if (!g || !b) return privateJson({ error: "Booking not found" }, 404);
    const url = siteUrl() + "/bookings?token=" + encodeURIComponent(token);
    const date = fullDate(b.date) + " · " + clock(b.time);
    if (q.get("provider") === "google" && google) {
      const key = await importPKCS8(
        process.env.GOOGLE_WALLET_PRIVATE_KEY!.replaceAll("\\n", "\n"),
        "RS256",
      );
      const classId = process.env.GOOGLE_WALLET_CLASS_ID!;
      const obj = {
        id:
          classId.split(".")[0] +
          ".trim_" +
          b.id.replaceAll("-", "") +
          "_" +
          b.date.replaceAll("-", "") +
          "_" +
          b.time,
        classId,
        state: "ACTIVE",
        hexBackgroundColor: "#161616",
        cardTitle: { defaultValue: { language: "en-GB", value: "Symmetry" } },
        header: { defaultValue: { language: "en-GB", value: b.service.name } },
        subheader: { defaultValue: { language: "en-GB", value: date } },
        textModulesData: [
          { id: "barber", header: "Your barber", body: b.barber.name },
          {
            id: "note",
            header: "Booking details",
            body: "This pass is a snapshot. Check your booking link for changes.",
          },
        ],
        linksModuleData: {
          uris: [{ uri: url, description: "Manage your trim", id: "manage" }],
        },
      };
      const jwt = await new SignJWT({
        iss: process.env.GOOGLE_WALLET_EMAIL,
        aud: "google",
        typ: "savetowallet",
        origins: [siteUrl()],
        payload: { genericObjects: [obj] },
      })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .sign(key);
      return Response.redirect("https://pay.google.com/gp/v/save/" + jwt);
    }
    if (q.get("provider") === "apple" && apple) {
      const pem = (key: string) =>
        Buffer.from(process.env[key]!.replaceAll("\\n", "\n"));
      const icon = await readFile(
        join(process.cwd(), "public/apple-touch-icon.png"),
      );
      const pass = new PKPass(
        { "icon.png": icon, "icon@2x.png": icon },
        {
          wwdr: pem("APPLE_WWDR_CERT"),
          signerCert: pem("APPLE_PASS_CERT"),
          signerKey: pem("APPLE_PASS_KEY"),
          signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSWORD,
        },
        {
          passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
          teamIdentifier: process.env.APPLE_TEAM_ID!,
          serialNumber: b.id + "-" + b.date + "-" + b.time,
          organizationName: "Symmetry Barbers",
          description: "Your Symmetry trim",
          foregroundColor: "rgb(239,235,227)",
          backgroundColor: "rgb(22,22,22)",
          labelColor: "rgb(239,235,227)",
        },
      );
      pass.type = "generic";
      pass.primaryFields.push({
        key: "trim",
        label: "YOUR TRIM",
        value: b.service.name,
      });
      pass.secondaryFields.push(
        { key: "when", label: "WHEN", value: date },
        { key: "barber", label: "WITH", value: b.barber.name },
      );
      pass.backFields.push(
        { key: "manage", label: "Manage your trim", value: url },
        {
          key: "note",
          label: "Keep up to date",
          value: "This is a snapshot. Check your booking link for changes.",
        },
      );
      return new Response(new Uint8Array(pass.getAsBuffer()), {
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": 'attachment; filename="symmetry-trim.pkpass"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    return privateJson({ error: "Wallet passes are not configured" }, 503);
  } catch {
    return publicError(
      new Error(
        "Your wallet pass could not be created. Use the calendar download instead.",
      ),
      503,
    );
  }
}
