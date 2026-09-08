import { redirect } from "next/navigation";
import { resolveUser } from "@/lib/auth";
import { loadSnapshot } from "@/lib/queries";
import { Drills } from "@/components/Drills";

// Reads the session on every request, so it is never statically cached.
export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await resolveUser();
  if (result.state !== "ok") redirect("/login");

  const snapshot = await loadSnapshot();

  return <Drills initialCategories={snapshot.categories} initialQuestions={snapshot.questions} user={result.user} />;
}
