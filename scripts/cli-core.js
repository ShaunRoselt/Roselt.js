import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const starterTemplateDirectory = path.join(rootDirectory, "examples", "starter-app");
const packageJson = JSON.parse(
  await fs.readFile(path.join(rootDirectory, "package.json"), "utf8"),
);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

export async function runRoseltCli(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printRoseltHelp();
    return;
  }

  if (["create", "init", "new"].includes(command)) {
    await createAppFromArgs(rest);
    return;
  }

  if (command === "serve") {
    await serveProject(rest);
    return;
  }

  throw new Error(`Unknown Roselt command: ${command}`);
}

export async function runCreateCli(argv = process.argv.slice(2)) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    printCreateHelp();
    return;
  }

  const createArgs = argv[0] === "create" ? argv.slice(1) : argv;
  await createAppFromArgs(createArgs);
}

async function createAppFromArgs(args) {
  const targetArgument = args[0];

  if (!targetArgument || targetArgument.startsWith("-")) {
    throw new Error("Usage: npm create roselt-js@latest <app-name>");
  }

  const targetDirectory = path.resolve(process.cwd(), targetArgument);
  const projectName = path.basename(targetDirectory);
  const packageName = toPackageName(projectName);
  const dependencyRange = `^${packageJson.version}`;

  await ensureTargetDirectory(targetDirectory);
  await fs.cp(starterTemplateDirectory, targetDirectory, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(targetDirectory, ".gitignore"), "node_modules/\n", "utf8"),
    fs.writeFile(
      path.join(targetDirectory, "README.md"),
      `# ${projectName}\n\nA starter Roselt.js app generated from the official starter template.\n\n## Commands\n\n- npm install\n- npm start\n\nThe local dev server defaults to http://127.0.0.1:42069.\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(targetDirectory, "package.json"),
      `${JSON.stringify(
        {
          name: packageName,
          private: true,
          type: "module",
          scripts: {
            start: "roselt serve",
          },
          devDependencies: {
            "roselt-js": dependencyRange,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    replaceInFile(
      path.join(targetDirectory, "index.html"),
      "Roselt Starter App",
      escapeHtml(projectName),
    ),
    replaceInFile(
      path.join(targetDirectory, "sections", "site-header.html"),
      "Roselt Starter App",
      escapeHtml(projectName),
    ),
  ]);

  console.log(`Created Roselt.js app in ${targetDirectory}`);
  console.log("Next steps:");
  console.log(`  cd ${displayPathForShell(targetDirectory)}`);
  console.log("  npm install");
  console.log("  npm start");
}

async function replaceInFile(filePath, searchValue, replacementValue) {
  const existingContent = await fs.readFile(filePath, "utf8");
  await fs.writeFile(filePath, existingContent.replaceAll(searchValue, replacementValue), "utf8");
}

function printRoseltHelp() {
  console.log(
    "Roselt.js CLI\n\nUsage:\n  roselt create <app-name>\n  roselt serve [root] [--host 127.0.0.1] [--port 42069]\n\nExamples:\n  npm create roselt-js@latest my-app\n  npx roselt-js create my-app\n  cd my-app && npm install && npm start",
  );
}

function printCreateHelp() {
  console.log(
    "Create a Roselt.js app\n\nUsage:\n  npm create roselt-js@latest <app-name>\n\nExample:\n  npm create roselt-js@latest my-app",
  );
}

async function ensureTargetDirectory(targetDirectory) {
  try {
    const stat = await fs.stat(targetDirectory);

    if (!stat.isDirectory()) {
      throw new Error(`Target exists and is not a directory: ${targetDirectory}`);
    }

    const existingEntries = await fs.readdir(targetDirectory);

    if (existingEntries.length > 0) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await fs.mkdir(targetDirectory, { recursive: true });
      return;
    }

    throw error;
  }
}

export async function serveProject(args) {
  const options = parseServeOptions(args);
  const rootPath = path.resolve(process.cwd(), options.root);
  const entryDocument = path.join(rootPath, "index.html");

  await fs.access(entryDocument);

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(
        request.url || "/",
        `http://${options.host}:${options.port}`,
      );
      const safePath = resolveRequestPath(rootPath, requestUrl.pathname);
      const filePath = await pickResponseFile(rootPath, safePath);

      if (!filePath) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      const fileBuffer = await fs.readFile(filePath);
      response.setHeader(
        "Content-Type",
        mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      );
      response.end(fileBuffer);
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : "Server error");
    }
  });

  await new Promise((resolve) => {
    server.listen(options.port, options.host, resolve);
  });

  console.log(`Roselt app running at http://${options.host}:${options.port}/`);
}

function parseServeOptions(args) {
  const options = {
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 42069),
    root: ".",
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--host") {
      options.host = args[index + 1] || options.host;
      index += 1;
      continue;
    }

    if (argument === "--port") {
      options.port = Number(args[index + 1] || options.port);
      index += 1;
      continue;
    }

    if (!argument.startsWith("-")) {
      options.root = argument;
      continue;
    }

    throw new Error(`Unknown serve option: ${argument}`);
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new Error("Port must be a positive number.");
  }

  return options;
}

function resolveRequestPath(rootPath, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const candidatePath = path.resolve(rootPath, `.${decodedPath}`);
  const relativePath = path.relative(rootPath, candidatePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid request path.");
  }

  return candidatePath;
}

async function pickResponseFile(rootPath, requestPath) {
  const resolvedPath = await resolveFilePath(requestPath);

  if (resolvedPath) {
    return resolvedPath;
  }

  if (!path.extname(requestPath)) {
    return path.join(rootPath, "index.html");
  }

  return null;
}

async function resolveFilePath(requestPath) {
  try {
    const stat = await fs.stat(requestPath);

    if (stat.isDirectory()) {
      return resolveFilePath(path.join(requestPath, "index.html"));
    }

    if (stat.isFile()) {
      return requestPath;
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  return null;
}

function toPackageName(projectName) {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "roselt-app";
}

function displayPathForShell(targetDirectory) {
  const relativePath = path.relative(process.cwd(), targetDirectory);

  if (!relativePath || relativePath.startsWith("..")) {
    return targetDirectory;
  }

  return relativePath;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}