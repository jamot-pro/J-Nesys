import type { JamotRepository } from "../repository/repository.js";

export interface OutreachProcessor {
  /** Creates one delegated task per due (campaign, step, person) triple for
   * the campaign's assigned agent. Idempotent: existing send records are skipped. */
  processDue(now: Date): Promise<{ created: number; skipped: number }>;
}

function buildTaskDescription(input: {
  campaignName: string;
  goal: string;
  stepPosition: number;
  channel: string;
  sendAfterDays: number;
  subject: string;
  template: string;
  instructions: string;
  displayName: string;
  email: string | null;
}): string {
  const lines = [
    `Outreach step ${input.stepPosition} of "${input.campaignName}".`,
    `Campaign goal: ${input.goal}`,
    `Target: ${input.displayName}${input.email ? ` <${input.email}>` : ""}`,
    `Channel: ${input.channel}`,
    `Send after: ${input.sendAfterDays} day(s) after campaign start`,
  ];
  if (input.subject) lines.push(`Subject: ${input.subject}`);
  if (input.template) lines.push(`\nDraft template:\n${input.template}`);
  if (input.instructions) lines.push(`\nInstructions:\n${input.instructions}`);
  lines.push(
    "\nPersonalize the message for this target and deliver it on the assigned channel.",
  );
  return lines.join("\n");
}

export function createOutreachProcessor(repo: JamotRepository): OutreachProcessor {
  return {
    async processDue(now) {
      const campaigns = await repo.listOutreachCampaigns({ status: "active" });
      let created = 0;
      let skipped = 0;

      for (const campaign of campaigns) {
        if (!campaign.startedAt) continue;

        const [steps, list] = await Promise.all([
          repo.listOutreachSteps(campaign.id),
          repo.getOutreachList(campaign.listId),
        ]);
        if (!list || list.memberPersonIds.length === 0) continue;

        const agent = await repo.getAgent(campaign.agentId);
        if (!agent) continue;

        const start = Date.parse(campaign.startedAt);
        for (const step of steps) {
          const dueAt = new Date(start + step.sendAfterDays * 86_400_000);
          if (dueAt > now) continue;
          const scheduledAt = dueAt.toISOString();

          for (const personId of list.memberPersonIds) {
            const existing = await repo.findOutreachSend(
              campaign.id,
              step.id,
              personId,
            );
            if (existing) {
              skipped += 1;
              continue;
            }

            const person = await repo.getPerson(personId);
            if (!person) continue;
            const actor = await repo.getActor(person.actorId);
            const displayName = actor?.displayName ?? "Prospect";

            const task = await repo.createTask({
              spaceId: campaign.spaceId,
              title: `[${campaign.name}] Step ${step.position + 1} — ${displayName}`,
              description: buildTaskDescription({
                campaignName: campaign.name,
                goal: campaign.goal,
                stepPosition: step.position + 1,
                channel: step.channel,
                sendAfterDays: step.sendAfterDays,
                subject: step.subject,
                template: step.template,
                instructions: step.instructions,
                displayName,
                email: person.email,
              }),
              status: "created",
              assigneeActorIds: [agent.actorId],
              targetType: "agent",
              dueDate: scheduledAt,
            });

            const send = await repo.createOutreachSend({
              campaignId: campaign.id,
              stepId: step.id,
              personId,
              status: "delegated",
              scheduledAt,
              taskId: task.id,
            });

            await repo.recordEvent({
              type: "outreach.send.delegated",
              spaceId: campaign.spaceId,
              actorId: agent.actorId,
              payload: {
                sendId: send.id,
                campaignId: campaign.id,
                stepId: step.id,
                personId,
                taskId: task.id,
              },
            });
            created += 1;
          }
        }
      }

      return { created, skipped };
    },
  };
}