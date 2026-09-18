import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConsoleRoot } from "@/components/console/ConsoleRoot";
import { NoOrg } from "@/components/NoOrg";
import { loadOrgBranding } from "@/lib/org";

export default async function ConsoleHome() {
  // hq.jamot.pro is the org configurator (create/list/manage every
  // organization), not a per-org skin — send it straight to the existing
  // Super Admin Console rather than resolving it as an org subdomain.
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase();
  if (rootDomain && host === `hq.${rootDomain}`) redirect("/admin");

  const org = await loadOrgBranding();
  if (!org) return <NoOrg />;
  return <ConsoleRoot branding={org} />;
}
