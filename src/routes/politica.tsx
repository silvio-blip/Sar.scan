import { createFileRoute, Navigate } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/politica")({
  component: () => <Navigate to="/direitos-privacidade" replace />,
});
