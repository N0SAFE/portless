import { Controller, Get, Query } from "@nestjs/common";
import { discoverWorkspace } from "@portless/config";
import type { ListProjectsResponse, ProjectSummary } from "@portless/contracts";

@Controller("api/v1/projects")
export class ProjectsController {
  @Get()
  async list(@Query("root") root?: string): Promise<ListProjectsResponse> {
    const cwd = root ?? process.cwd();
    const workspace = await discoverWorkspace(cwd);
    const projects: ProjectSummary[] = [
      {
        root: workspace.root,
        name: workspace.packages[0]?.name ?? "project",
        hasProjectConfig: false,
        packages: workspace.packages.map((p) => ({
          relativePath: p.relativePath,
          name: p.name,
          hasDevScript: Boolean(p.scripts?.dev),
        })),
      },
    ];
    return { projects };
  }
}
