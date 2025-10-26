"use client";

import { useState } from "react";
import RendererComponent from "../components/renderer-component";

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="flex flex-col justify-center items-center h-full">
        <RendererComponent onError={setError} />
        {error != null ? <div className="font-bold text-red-500">{error}</div> : undefined}
      </div>
    </>
  );
}
