import { createFileRoute, Navigate } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/_app/scan")({
  component: ScanRedirectComponent,
});

function ScanRedirectComponent() {
  return <Navigate to="/scanner" replace />;
}
