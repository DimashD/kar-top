import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { StaffService } from './staff.service';
import { PlatformAdminGuard } from '../../common/auth/platform-admin.guard';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(20) phone!: string;
  @IsString() @MinLength(6) @MaxLength(100) password!: string;
  @IsIn(['PLATFORM_ADMIN', 'SUPPORT']) role!: Role;
}

class SetRoleDto {
  // NONE = отозвать доступ.
  @IsIn(['PLATFORM_ADMIN', 'SUPPORT', 'NONE']) role!: 'PLATFORM_ADMIN' | 'SUPPORT' | 'NONE';
}

class SetPasswordDto {
  @IsString() @MinLength(6) @MaxLength(100) password!: string;
}

@UseGuards(PlatformAdminGuard)
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Patch(':id/role')
  setRole(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SetRoleDto) {
    const role = dto.role === 'NONE' ? null : (dto.role as Role);
    return this.staff.setRole(user.userId, id, role);
  }

  @Patch(':id/password')
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.staff.setPassword(id, dto.password);
  }
}
