import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { TenantsService } from "./tenants.service";

@UseGuards(JwtAuthGuard)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(user, dto);
  }

  @Get(":tenantId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("tenantId") tenantId: string) {
    return this.tenantsService.findOne(user, tenantId);
  }

  @Patch(":tenantId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantDto
  ) {
    return this.tenantsService.update(user, tenantId, dto);
  }

  @Post(":tenantId/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("tenantId") tenantId: string) {
    return this.tenantsService.archive(user, tenantId);
  }

  @Post(":tenantId/unarchive")
  unarchive(@CurrentUser() user: AuthenticatedUser, @Param("tenantId") tenantId: string) {
    return this.tenantsService.unarchive(user, tenantId);
  }
}
