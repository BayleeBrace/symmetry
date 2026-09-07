import { requireStaff } from "@/lib/staff";
import { deliveryHealth } from "@/lib/delivery-health";
import { privateJson, publicError } from "@/lib/security";
export async function GET() {
  try {
    await requireStaff(true);
    return privateJson(await deliveryHealth());
  } catch (e) {
    return publicError(e, 403);
  }
}
