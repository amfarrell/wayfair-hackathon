import { tool } from "ai";
import { z } from "zod";

type DeliverySlot = {
  date: string;
  window: string;
  forecast: string;
};

type Order = {
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  item: string;
  sku: string;
  deliveryType: "white-glove" | "doorstep" | "curbside";
  scheduledDate: string;
  scheduledWindow: string;
  status: "scheduled" | "rescheduled" | "delivered";
};

const ANDREWS_ORDER: Order = {
  orderId: "WF-2407",
  customerName: "Andrew",
  customerPhone: "(617) 555-0142",
  address: "42 Beacon St, Boston, MA 02108",
  item: "Birch Lane Heritage Velvet Sectional Sofa (Forest Green)",
  sku: "WF-1003",
  deliveryType: "white-glove",
  scheduledDate: "Wednesday, May 27, 2026",
  scheduledWindow: "10:00 AM – 12:00 PM",
  status: "scheduled",
};

const MEATBALL_FORECAST = {
  date: "Wednesday, May 27, 2026",
  location: "Boston, MA",
  condition: "Torrential meatballs",
  severity: "severe",
  timing: "9:00 AM – 3:00 PM",
  details:
    "Heavy meatball precipitation expected throughout the morning. " +
    "Meatballs measuring 2–4 inches in diameter, accompanied by light marinara mist. " +
    "NWS advisory: unprotected outdoor items at high risk of staining, soaking, and meat-based fiber damage.",
  alertIssuedAt: "2026-05-26T22:00:00Z",
};

const ALTERNATE_SLOTS: DeliverySlot[] = [
  { date: "Thursday, May 28", window: "10:00 AM – 12:00 PM", forecast: "Sunny, 72°F, no precipitation" },
  { date: "Thursday, May 28", window: "2:00 PM – 4:00 PM", forecast: "Sunny, 75°F, light breeze" },
  { date: "Friday, May 29", window: "8:00 AM – 10:00 AM", forecast: "Partly cloudy, 68°F" },
  { date: "Friday, May 29", window: "1:00 PM – 3:00 PM", forecast: "Sunny, 73°F" },
  { date: "Saturday, May 30", window: "10:00 AM – 12:00 PM", forecast: "Clear, 70°F" },
  { date: "Saturday, May 30", window: "3:00 PM – 5:00 PM", forecast: "Sunny, 74°F" },
  { date: "Monday, June 1", window: "9:00 AM – 11:00 AM", forecast: "Mostly sunny, 69°F" },
  { date: "Monday, June 1", window: "2:00 PM – 4:00 PM", forecast: "Sunny, 71°F" },
  { date: "Tuesday, June 2", window: "10:00 AM – 12:00 PM", forecast: "Sunny, 72°F" },
  { date: "Tuesday, June 2", window: "3:00 PM – 5:00 PM", forecast: "Clear, 73°F" },
];

const orderState: Order = { ...ANDREWS_ORDER };

export const getMyDelivery = tool({
  description:
    "Look up the customer's currently scheduled delivery. Returns order ID, item, address, delivery type, scheduled date and window, and current status.",
  inputSchema: z.object({}),
  execute: async () => {
    return { order: orderState };
  },
});

export const checkWeatherForDelivery = tool({
  description:
    "Check the weather forecast for the customer's scheduled delivery date and location. Returns condition, severity, and risk details. Use this BEFORE talking to the customer so you know what you're dealing with.",
  inputSchema: z.object({
    date: z.string().describe("The scheduled delivery date, e.g. 'Wednesday, May 27, 2026'"),
    location: z.string().describe("The delivery city, e.g. 'Boston, MA'"),
  }),
  execute: async ({ date, location }) => {
    if (date.includes("May 27") || date.includes("2026-05-27")) {
      return {
        date,
        location,
        forecast: MEATBALL_FORECAST,
        deliveryRisk:
          "HIGH — torrential meatballs during the scheduled delivery window. " +
          "White-glove crews would have to carry an unwrapped velvet sectional through actively falling meatballs. " +
          "Velvet absorbs marinara stains permanently and the impact weight can compress the foam core. Strongly recommend rescheduling.",
      };
    }
    return {
      date,
      location,
      forecast: { condition: "Clear", severity: "none" },
      deliveryRisk: "LOW — proceed as scheduled.",
    };
  },
});

export const findClearDeliverySlots = tool({
  description:
    "Find alternate delivery slots where the weather forecast is clear. Returns up to `count` slots. " +
    "If the customer mentioned a specific day or kind of day ('Monday', 'this weekend', 'next week'), " +
    "pass it as `preferredDays` so the tool filters by weekday. " +
    "Otherwise, pass `excluding` to skip slots you've already shown them.",
  inputSchema: z.object({
    count: z.number().min(1).max(5).default(3).describe("How many slots to return"),
    preferredDays: z
      .array(z.string())
      .optional()
      .describe(
        "Day names the customer asked for, e.g. ['Monday'] or ['Saturday','Sunday'] for 'weekend'. Filters the pool to matching weekdays only. Case-insensitive.",
      ),
    excluding: z
      .array(z.string())
      .optional()
      .describe(
        "Array of slot identifiers (formatted '<date> @ <window>') the customer has already seen. Used to fetch a fresh batch when they want different options without a specific day preference.",
      ),
  }),
  execute: async ({ count, preferredDays, excluding }) => {
    console.log("[findClearDeliverySlots] args:", { count, preferredDays, excluding });
    const seen = new Set(excluding ?? []);
    const dayFilters = (preferredDays ?? []).map((d) => d.toLowerCase().trim());

    let pool = ALTERNATE_SLOTS.filter(
      (s) => !seen.has(`${s.date} @ ${s.window}`),
    );
    if (dayFilters.length > 0) {
      pool = pool.filter((s) =>
        dayFilters.some((d) => s.date.toLowerCase().includes(d)),
      );
    }
    const fresh = pool.slice(0, count);

    // Always include the full list of days that have open slots — even when
    // filtering — so the agent can self-correct if it filtered for the wrong day.
    const allAvailableDays = Array.from(
      new Set(ALTERNATE_SLOTS.map((s) => s.date)),
    );

    return {
      slots: fresh,
      remainingInPool: pool.length - fresh.length,
      filterApplied: dayFilters.length > 0 ? dayFilters : null,
      allAvailableDays,
      note:
        dayFilters.length > 0 && fresh.length === 0
          ? `No clear-weather slots available matching ${dayFilters.join("/")}. Available days in the pool are: ${allAvailableDays.join("; ")}. Tell the customer honestly and offer the nearest matching day.`
          : undefined,
    };
  },
});

export const confirmReschedule = tool({
  description:
    "Confirm the customer's chosen new delivery slot and update dispatch. Call this ONLY after the customer has explicitly chosen one of the offered slots.",
  inputSchema: z.object({
    newDate: z.string().describe("The chosen date, e.g. 'Thursday, May 28'"),
    newWindow: z.string().describe("The chosen window, e.g. '2:00 PM – 4:00 PM'"),
  }),
  execute: async ({ newDate, newWindow }) => {
    orderState.scheduledDate = newDate;
    orderState.scheduledWindow = newWindow;
    orderState.status = "rescheduled";
    return {
      success: true,
      confirmationNumber: `RSC-${Math.floor(Math.random() * 90000 + 10000)}`,
      order: orderState,
      dispatchUpdated: true,
      driverNotified: true,
      message: "Dispatch has been updated. The crew has been notified. No reschedule fee.",
    };
  },
});

export const deliveryTools = {
  getMyDelivery,
  checkWeatherForDelivery,
  findClearDeliverySlots,
  confirmReschedule,
};
