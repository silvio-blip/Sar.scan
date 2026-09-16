import React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="size-12 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile && !profile.onboarding_done) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/scanner" replace />;
}
