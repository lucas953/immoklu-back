import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { PropertiesService } from "./properties.service";

@UseGuards(JwtAuthGuard)
@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(user, dto);
  }

  @Get(":propertyId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.propertiesService.findOne(user, propertyId);
  }

  @Patch(":propertyId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("propertyId") propertyId: string,
    @Body() dto: UpdatePropertyDto
  ) {
    return this.propertiesService.update(user, propertyId, dto);
  }

  @Post(":propertyId/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.propertiesService.archive(user, propertyId);
  }

  @Post(":propertyId/unarchive")
  unarchive(@CurrentUser() user: AuthenticatedUser, @Param("propertyId") propertyId: string) {
    return this.propertiesService.unarchive(user, propertyId);
  }
}
