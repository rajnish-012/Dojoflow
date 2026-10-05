"use client";

import HomepageCMS from "@/components/website/HomepageCMS";

export default function HomepageCMSPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-(--background)">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <HomepageCMS />
      </div>
    </div>
  );
}
