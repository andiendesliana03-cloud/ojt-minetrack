
"use client";

import { useParams } from "next/navigation";
import OjtInsights from "../../components/OjtInsights";

export default function AnalisisPage() {
  const params = useParams();

  return (
    <OjtInsights
      id={params.id}
      mode="analisis"
    />
  );
}
