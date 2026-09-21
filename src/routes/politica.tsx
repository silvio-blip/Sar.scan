import { createFileRoute, Navigate } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/politica")({
  component: () => {
    if (typeof window !== "undefined") {
      window.location.replace("/direitos-privacidade?tab=privacidade");
    }
    return null;
  },
});
