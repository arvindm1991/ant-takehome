"use client";
import { useEffect, useState } from "react";

export type DeployStatus = {
  mainAgent: { live: boolean; model: string };
  learningAgent: { live: boolean; model: string };
  grader: { model: string };
  widgetBuilder: { model: string };
  classifier: { model: string };
};

/** Which parts of this deployment call the Claude API for real (no key ⇒ scripted mock). */
export function useDeployStatus() {
  const [status, setStatus] = useState<DeployStatus | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  return status;
}
