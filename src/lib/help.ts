/**
 * The staff app's help guide: short how-tos for everything in the app, and
 * the search that finds them. Plain data and maths, so it can be checked in
 * tests. Keep each answer to the taps it takes, in the app's own words.
 */
export type HelpArticle = {
  id: string;
  title: string;
  topic: HelpTopic;
  /** Only the owner sees it (the screen it describes is the owner's). */
  owner?: boolean;
  /** Other words people might search with. */
  words: string[];
  steps: string[];
  note?: string;
};

export type HelpTopic =
  | "Diary"
  | "Checkout and cards"
  | "Clients"
  | "Money"
  | "Your phone"
  | "Running the shop";

export const HELP_TOPICS: HelpTopic[] = [
  "Diary",
  "Checkout and cards",
  "Clients",
  "Money",
  "Your phone",
  "Running the shop",
];

export const HELP: HelpArticle[] = [
  // Diary
  {
    id: "book",
    title: "Book an appointment",
    topic: "Diary",
    words: ["add", "new", "appointment", "booking", "make", "client"],
    steps: [
      "Tap the plus, then New appointment.",
      "Drag the plus to the time and chair, then tap Next. Or just tap a gap in the diary.",
      "Choose the service, then type the client’s name to find them, or add someone new.",
      "Tap Book.",
    ],
    note: "For a regular, set it to repeat every few weeks in the same form: clients can’t book repeats online, so that’s the shop’s job. Clients can book online up to two months ahead; staff can book further.",
  },
  {
    id: "walk-in",
    title: "Add a walk-in",
    topic: "Diary",
    words: ["walkin", "walk", "now", "no", "booking", "door"],
    steps: [
      "Tap the plus, then Walk-in now.",
      "It starts straight away, even if the chair is booked: it’s squeezed in alongside.",
      "If they can wait, tap “Or the next free time”.",
      "Leave the name as Walk-in, or type theirs, then save.",
    ],
  },
  {
    id: "squeeze",
    title: "Squeeze someone in over a booking",
    topic: "Diary",
    words: ["overlap", "double", "fit", "quick", "over", "top", "same time"],
    steps: [
      "Tap the booking that’s in the way.",
      "Tap Squeeze in, next to Move.",
      "Fill in the new appointment and tap Squeeze in.",
    ],
    note: "The two show side by side in the diary. Online bookings can never overlap; only staff can squeeze in.",
  },
  {
    id: "move",
    title: "Move an appointment",
    topic: "Diary",
    words: ["change", "time", "reschedule", "drag", "another", "day", "chair"],
    steps: [
      "Hold the appointment in the diary and drag it to another time or chair.",
      "Or tap it, tap Move, and choose the new day and time.",
    ],
    note: "The client gets a text and an email with the new time.",
  },
  {
    id: "cancel",
    title: "Cancel an appointment",
    topic: "Diary",
    words: ["delete", "remove", "cancelled", "late cancellation"],
    steps: ["Tap the appointment, tap Cancel, and confirm."],
    note: "It leaves the diary but stays in the client’s history. If it’s inside the cancellation window, a late-cancellation fee waits in the booking for the owner to charge or waive.",
  },
  {
    id: "no-show",
    title: "Mark a no-show",
    topic: "Diary",
    words: ["noshow", "didn’t turn up", "missed", "absent"],
    steps: [
      "Once the start time has passed, tap the appointment.",
      "Tap No show and confirm.",
    ],
    note: "If the client saved a card when they booked, the no-show fee waits in the booking for the owner to charge or waive.",
  },
  {
    id: "behind",
    title: "Tell clients you’re running behind",
    topic: "Diary",
    words: ["late", "delay", "behind", "text", "waiting"],
    steps: [
      "At the top of your chair in the diary, tap Running behind? (Late? on a phone).",
      "Pick 10, 15, 20 or 30 minutes.",
    ],
    note: "Your next two clients get a text, or an email if there’s no mobile.",
  },
  {
    id: "block",
    title: "Block time for a break or a holiday",
    topic: "Diary",
    words: [
      "break",
      "lunch",
      "holiday",
      "day off",
      "blocked",
      "away",
      "closed",
    ],
    steps: [
      "Tap the plus, then Blocked time.",
      "Choose the chair, the day and the time, or a run of days for a holiday.",
      "Save it.",
    ],
    note: "Nobody can book online into blocked time.",
  },
  {
    id: "waitlist",
    title: "The waitlist",
    topic: "Diary",
    words: ["waiting", "list", "cancellation", "free", "slot"],
    steps: ["Tap the plus, then Waitlist, to see who’s waiting for each day."],
    note: "When a time frees up, the app offers it to the people waiting for that day, one at a time.",
  },
  {
    id: "book-again",
    title: "Book a client in again",
    topic: "Diary",
    words: ["rebook", "again", "next", "repeat", "same"],
    steps: [
      "Tap a finished trim, then Book again.",
      "It opens with the same client, chair and trim. Pick the time and book.",
    ],
  },
  {
    id: "views",
    title: "Day view, week view and other chairs",
    topic: "Diary",
    words: ["week", "day", "all chairs", "my chair", "calendar", "see"],
    steps: [
      "At the top of Calendar, switch between Day and Week.",
      "Choose your own chair, or all chairs, to see the whole shop.",
    ],
  },

  // Checkout and cards
  {
    id: "checkout",
    title: "Check out a trim",
    topic: "Checkout and cards",
    words: ["pay", "paid", "finish", "done", "complete", "cash", "till"],
    steps: [
      "Tap the trim, then Checkout. It opens from the trim’s start time.",
      "Change what was done or the price if it’s different.",
      "Take it on the card machine, or tap Card, Cash or Other to record how they paid.",
    ],
  },
  {
    id: "card-machine",
    title: "Take a payment on the card machine",
    topic: "Checkout and cards",
    words: [
      "card",
      "machine",
      "tap",
      "contactless",
      "stripe",
      "reader",
      "pay",
      "tip",
      "tips",
    ],
    steps: [
      "At checkout, tap Take £… on the card machine.",
      "The price shows on the machine. The client can add a tip, then taps their card or phone.",
      "The trim marks itself paid. Any tip goes to the barber.",
    ],
    note: "Declined? Tap Try again; it never charges twice. To stop, tap Cancel the payment. In practice mode, tap Tap a test card instead of a real card.",
  },
  {
    id: "card-money",
    title: "Where card money goes",
    topic: "Checkout and cards",
    words: ["bank", "payout", "paid", "when", "fee", "stripe", "money"],
    steps: [
      "Card payments go into the barber’s own Stripe account, and Stripe pays them into their own bank once a week, on Mondays.",
      "The card fee comes off first: 43p on a £20 trim. Tips go to the barber too.",
      "To see payouts: More, Card payments, See your payouts.",
    ],
    note: "The very first payout can take a little longer. Rent is never taken out; it’s paid to the shop separately.",
  },
  {
    id: "card-setup",
    title: "Set up your card payments",
    topic: "Checkout and cards",
    words: ["stripe", "sign up", "bank", "account", "onboard", "connect"],
    steps: [
      "More, Card payments, Set up card payments.",
      "Stripe asks for your name, address, photo ID and your own bank details. About ten minutes, once.",
    ],
    note: "In practice mode, use Stripe’s test details: phone code 000000, sort code 10-88-00, account 00012345.",
  },
  {
    id: "fees",
    title: "Charge or waive a no-show or late fee",
    topic: "Checkout and cards",
    owner: true,
    words: ["fee", "charge", "waive", "no show", "late", "saved card"],
    steps: [
      "Open the booking. The fee shows underneath.",
      "Tap Charge fee to take it from their saved card, or Waive.",
    ],
    note: "A charged fee goes to that chair’s barber, less the card fee.",
  },
  {
    id: "refund",
    title: "Refund a card payment",
    topic: "Checkout and cards",
    owner: true,
    words: ["refund", "money back", "return", "unhappy"],
    steps: ["Open the paid trim in the diary, then tap Refund and confirm."],
    note: "The full amount goes back to their card in a few days, and comes back out of that barber’s takings.",
  },
  {
    id: "add-machine",
    title: "Add the card machine",
    topic: "Checkout and cards",
    owner: true,
    words: ["reader", "s700", "register", "machine", "stripe", "practice"],
    steps: [
      "More, Card payments.",
      "In practice mode, tap Add a practice card machine.",
      "For the real one, type the words on the machine’s screen, then tap Register the card machine.",
    ],
  },

  // Clients
  {
    id: "find-client",
    title: "Find a client",
    topic: "Clients",
    words: ["search", "customer", "phone", "number", "history", "visits"],
    steps: [
      "Open Clients and search by name, mobile or email.",
      "Open them to see their visits, notes and any no-shows.",
    ],
    note: "From a booking, the Call, Text and Email buttons contact them straight away.",
  },
  {
    id: "client-notes",
    title: "Add notes or change a client’s details",
    topic: "Clients",
    words: ["notes", "preferences", "edit", "details", "mobile", "email"],
    steps: [
      "Open the client in Clients, then tap Edit.",
      "Change their details or notes, like “number two on the sides”, and save.",
    ],
    note: "Notes show on every booking for that client.",
  },
  {
    id: "test-clients",
    title: "Test clients",
    topic: "Clients",
    owner: true,
    words: ["test", "practice", "pretend", "fake", "remove", "delete"],
    steps: [
      "More, Card payments, Test clients.",
      "Add test clients puts ten pretend clients and their trims in the diary.",
      "Remove all test clients takes them out, and nothing else.",
    ],
    note: "Test clients have no phone or email, so nothing is ever sent to them.",
  },
  {
    id: "messages",
    title: "Texts and emails clients get",
    topic: "Clients",
    words: ["text", "sms", "email", "reminder", "confirmation", "message"],
    steps: [
      "A confirmation when they book, and a reminder the day before.",
      "A message if their trim is moved or cancelled, or you’re running behind.",
    ],
    note: "Each text fits in one message, about 5p. Texts start once Twilio is connected.",
  },

  // Money
  {
    id: "sales",
    title: "See your sales",
    topic: "Money",
    words: ["takings", "money", "today", "week", "card", "cash", "total"],
    steps: [
      "Open Sales to see takings by day, by card and cash, and the trims done.",
    ],
    note: "Each barber sees their own. The owner sees every chair.",
  },
  {
    id: "payouts",
    title: "Your pay and rent",
    topic: "Money",
    words: ["rent", "pay", "payout", "owed", "week", "chair"],
    steps: [
      "Open Payouts (Your pay for barbers).",
      "It shows your takings, what Stripe has already paid you, cash kept, and the rent owed for the period.",
    ],
    note: "Rent is paid to the shop separately. It’s never taken out of your card money.",
  },
  {
    id: "rent-rules",
    title: "Set each barber’s rent and record payments",
    topic: "Money",
    owner: true,
    words: ["rent", "rules", "bank", "mark paid", "pay everyone", "bank file"],
    steps: [
      "In Payouts, open a barber’s Rules and bank to set their weekly rent.",
      "Tap Mark paid to record a payment, or Pay everyone for all at once.",
    ],
    note: "Bank file downloads a spreadsheet for a bulk bank payment.",
  },

  // Your phone
  {
    id: "home-screen",
    title: "Put the app on your Home Screen",
    topic: "Your phone",
    words: ["icon", "install", "app", "iphone", "safari", "home"],
    steps: [
      "In Safari, go to symmetrywales.com/staff and sign in.",
      "Tap the Share button, then Add to Home Screen.",
    ],
  },
  {
    id: "face-id",
    title: "Sign in with Face ID",
    topic: "Your phone",
    words: ["face id", "fingerprint", "sign in", "login", "passkey"],
    steps: ["More, Your account, then Set up Face ID on this phone."],
    note: "Set it up once on each phone. Needs iOS 17 or later.",
  },
  {
    id: "password",
    title: "Change your password",
    topic: "Your phone",
    words: ["password", "sign in", "login", "forgot", "reset"],
    steps: ["More, Your account, then change your password."],
    note: "Forgotten it? The owner can reset it in More, Team and hours.",
  },
  {
    id: "notifications",
    title: "Turn on notifications",
    topic: "Your phone",
    words: ["notifications", "alerts", "push", "buzz", "ping"],
    steps: [
      "More, Notifications.",
      "Turn them on for this phone, choose what you get, and send a test.",
    ],
  },

  // Running the shop
  {
    id: "sign-ins",
    title: "Give a barber a sign-in",
    topic: "Running the shop",
    owner: true,
    words: ["sign in", "login", "account", "team", "staff", "password", "add"],
    steps: [
      "More, Team and hours.",
      "Next to the barber, tap Create sign-in. Add their email and a temporary password.",
      "They sign in at symmetrywales.com/staff and can change the password.",
    ],
    note: "Reset a password or switch a sign-in off in the same place.",
  },
  {
    id: "hours",
    title: "Change opening hours or a barber’s hours",
    topic: "Running the shop",
    owner: true,
    words: ["hours", "open", "close", "shift", "days", "working"],
    steps: ["More, Team and hours."],
  },
  {
    id: "prices",
    title: "Change prices and services",
    topic: "Running the shop",
    owner: true,
    words: ["price", "cost", "service", "menu", "add", "duration"],
    steps: ["More, Services and prices."],
  },
  {
    id: "policy",
    title: "The cancellation policy",
    topic: "Running the shop",
    owner: true,
    words: ["policy", "cancellation", "no show", "fee", "notice", "percent"],
    steps: [
      "More, Cancellation policy: the notice period, and the late-cancellation and no-show charges.",
    ],
  },
  {
    id: "export",
    title: "Download clients and bookings",
    topic: "Running the shop",
    owner: true,
    words: ["export", "download", "spreadsheet", "csv", "excel", "data"],
    steps: ["More, Your data. Best done on a computer."],
  },
];

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9£ ]+/g, " ");

/**
 * The articles that match what was typed, best first. Every word typed has
 * to appear somewhere (a word matches the start of a word in the article);
 * a match in the title counts most, then the extra search words, then the
 * steps. Owner-only articles are left out for everyone else.
 */
export function searchHelp(
  query: string,
  { owner = false }: { owner?: boolean } = {},
) {
  const visible = HELP.filter((a) => owner || !a.owner);
  const terms = clean(query).split(" ").filter(Boolean);
  if (!terms.length) return visible;
  const scored = visible.map((a) => {
    const title = clean(a.title).split(" ");
    const words = clean(a.words.join(" ")).split(" ");
    const body = clean([...a.steps, a.note ?? "", a.topic].join(" ")).split(
      " ",
    );
    let score = 0;
    for (const t of terms) {
      const hit = (list: string[]) => list.some((w) => w.startsWith(t));
      const s =
        (hit(title) ? 3 : 0) + (hit(words) ? 2 : 0) + (hit(body) ? 1 : 0);
      if (!s) return { a, score: 0 };
      score += s;
    }
    return { a, score };
  });
  return scored
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((r) => r.a);
}
