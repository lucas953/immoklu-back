import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateLeaseDto } from "./dto/create-lease.dto";
import { TerminateLeaseDto } from "./dto/terminate-lease.dto";
import { UpdateLeaseDto } from "./dto/update-lease.dto";
import { LeasesService } from "./leases.service";

@UseGuards(JwtAuthGuard)
@Controller("leases")
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.leasesService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeaseDto) {
    return this.leasesService.create(user, dto);
  }

  @Get(":leaseId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("leaseId") leaseId: string) {
    return this.leasesService.findOne(user, leaseId);
  }

  @Patch(":leaseId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leaseId") leaseId: string,
    @Body() dto: UpdateLeaseDto
  ) {
    return this.leasesService.update(user, leaseId, dto);
  }

  @Post(":leaseId/terminate")
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leaseId") leaseId: string,
    @Body() dto: TerminateLeaseDto
  ) {
    return this.leasesService.terminate(user, leaseId, dto);
  }
}
