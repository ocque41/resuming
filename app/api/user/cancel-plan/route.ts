import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import { getTeamForUser, getUser, updateTeamSubscription } from "@/lib/db/queries.server";
import { teams } from "@/lib/db/schema";

type Team = typeof teams.$inferSelect;

function normalizeTeam(data: unknown): Team | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const normalized = normalizeTeam(item);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (typeof record.id === "number" && typeof record.name === "string") {
      const createdAt = record.createdAt instanceof Date
        ? record.createdAt
        : typeof record.createdAt === "string"
          ? new Date(record.createdAt)
          : null;

      const updatedAt = record.updatedAt instanceof Date
        ? record.updatedAt
        : typeof record.updatedAt === "string"
          ? new Date(record.updatedAt)
          : null;

      if (!createdAt || !updatedAt || Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
        return null;
      }

      const normalized: Team = {
        id: record.id,
        name: record.name,
        createdAt,
        updatedAt,
        stripeCustomerId: (record.stripeCustomerId as string | null) ?? null,
        stripeSubscriptionId: (record.stripeSubscriptionId as string | null) ?? null,
        stripeProductId: (record.stripeProductId as string | null) ?? null,
        planName: (record.planName as string | null) ?? null,
        subscriptionStatus: (record.subscriptionStatus as string | null) ?? null,
      };

      return normalized;
    }

    if ("team" in record) {
      const nested = normalizeTeam(record.team);
      if (nested) {
        return nested;
      }
    }

    if ("teamMembers" in record) {
      return normalizeTeam(record.teamMembers);
    }
  }

  return null;
}

export async function POST() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamData = await getTeamForUser(user.id);

    if (!teamData) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = normalizeTeam(teamData);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (!team.planName && !team.stripeSubscriptionId) {
      return NextResponse.json({
        success: true,
        message: "No active subscription found.",
        subscriptionStatus: "canceled",
      });
    }

    let subscriptionStatus = "canceled";

    if (team.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.cancel(team.stripeSubscriptionId);
        subscriptionStatus = subscription.status || "canceled";
      } catch (error) {
        console.error("Error cancelling Stripe subscription", error);
        const message =
          error instanceof Error ? error.message : "Unable to cancel your subscription at this time.";

        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus,
    });

    return NextResponse.json({
      success: true,
      message: "Your subscription has been cancelled.",
      subscriptionStatus,
    });
  } catch (error) {
    console.error("Failed to cancel plan", error);
    const message = error instanceof Error ? error.message : "Failed to cancel plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
