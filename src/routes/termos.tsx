import { createFileRoute, Navigate } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/termos")({
  component: () => {
    if (typeof window !== "undefined") {
      window.location.replace("/direitos-privacidade?tab=termos");
    }
    return null;
  },
});
