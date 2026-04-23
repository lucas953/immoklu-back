import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { WorkspaceService } from "./workspace.service";

@UseGuards(JwtAuthGuard)
@Controller("workspace")
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  getWorkspace(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.getWorkspace(user);
  }

  @Patch()
  updateWorkspace(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.updateWorkspace(user, dto);
  }
}
