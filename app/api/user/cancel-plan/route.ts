import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import { getTeamForUser, getUser, updateTeamSubscription } from "@/lib/db/queries.server";
import { teams } from "@/lib/db/schema";

type Team = typeof teams.$inferSelect;

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

    const team = teamData as Team;

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
