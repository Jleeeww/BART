import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Connection } from "@replit/connectors-sdk/types";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";

interface GitHubConnectionSettings {
  access_token?: string;
  oauth?: {
    credentials?: {
      access_token?: string;
    };
  };
}

interface GitHubConnection extends Connection {
  settings?: GitHubConnectionSettings;
}

const connectors = new ReplitConnectors();

async function getGitHubToken(): Promise<string> {
  const connections = await connectors.listConnections({
    connector_names: "github",
    refresh_policy: "none",
  });

  if (!connections.length) {
    throw new Error("No GitHub connection found. Set up the GitHub connector first.");
  }

  const connection = connections[0] as GitHubConnection;

  if (connection.settings?.access_token) {
    return connection.settings.access_token;
  }

  if (connection.settings?.oauth?.credentials?.access_token) {
    return connection.settings.oauth.credentials.access_token;
  }

  throw new Error(
    "Could not retrieve GitHub access token from connector. " +
      "Available keys: " +
      JSON.stringify(Object.keys(connection)),
  );
}

async function main() {
  console.log("Getting GitHub user info...");
  const userResponse = await connectors.proxy("github", "/user", {
    method: "GET",
  });
  const userData = await userResponse.json();
  const owner = userData.login;
  const repo = "BART";
  console.log(`Authenticated as: ${owner}`);

  console.log("Creating private repository 'BART'...");
  const createRepoResponse = await connectors.proxy("github", "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: repo,
      private: true,
      description: "BART application",
    }),
  });
  const repoData = await createRepoResponse.json();
  if (createRepoResponse.status === 201) {
    console.log(`Repository created: ${repoData.html_url}`);
  } else if (createRepoResponse.status === 422) {
    console.log("Repository already exists, continuing...");
  } else {
    console.error("Failed to create repository:", JSON.stringify(repoData, null, 2));
    process.exit(1);
  }

  const remoteUrl = `https://github.com/${owner}/${repo}.git`;
  try {
    execSync("git remote remove origin", { cwd: process.cwd(), stdio: "pipe" });
    console.log("Removed existing 'origin' remote.");
  } catch {}
  execSync(`git remote add origin ${remoteUrl}`, { cwd: process.cwd(), stdio: "inherit" });
  console.log(`Added 'origin' remote: ${remoteUrl}`);

  console.log("Retrieving GitHub token from connector...");
  const token = await getGitHubToken();
  console.log("Token retrieved successfully.");

  const credentialHelperPath = "/tmp/git-credential-github.sh";
  writeFileSync(
    credentialHelperPath,
    `#!/bin/bash\necho "username=x-access-token"\necho "password=${token}"\n`,
    { mode: 0o700 },
  );

  console.log("Pushing all commits to main branch...");
  try {
    execSync(
      `git -c credential.helper="${credentialHelperPath}" push origin HEAD:main`,
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      },
    );
  } finally {
    try { unlinkSync(credentialHelperPath); } catch {}
  }

  console.log(`\nDone! All commits pushed to https://github.com/${owner}/${repo}`);
  console.log(`Remote 'origin' set to ${remoteUrl}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
