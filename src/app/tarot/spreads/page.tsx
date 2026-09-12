import { redirect } from "next/navigation";

export const metadata = { title: "Spreads — Cosmic Spirit Guide" };

export default function TarotSpreadsPage() {
  // /tarot IS the spread menu now; consolidate the old destination.
  redirect("/tarot");
}
