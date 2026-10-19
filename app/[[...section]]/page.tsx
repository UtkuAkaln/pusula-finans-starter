import { redirect, notFound } from "next/navigation";
import FinanceApp from "@/components/finance-app";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const page = section?.[0] || "panel";
  if (
    (section?.length || 0) > 1 ||
    ![
      "panel",
      "islemler",
      "gelirler",
      "sabitler",
      "hedefler",
      "hesaplar",
      "ayarlar",
    ].includes(page)
  )
    notFound();
  if (page === "hesaplar") redirect("/#hesaplar");
  return <FinanceApp section={page} />;
}
