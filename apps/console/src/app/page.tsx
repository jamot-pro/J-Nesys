import { ConsoleRoot } from "@/components/console/ConsoleRoot";
import { NoOrg } from "@/components/NoOrg";
import { loadOrgBranding } from "@/lib/org";

export default async function ConsoleHome() {
  const org = await loadOrgBranding();
  if (!org) return <NoOrg />;
  return <ConsoleRoot branding={org} />;
}
