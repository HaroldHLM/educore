import { Controller, Post, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';
import { TenantGuard } from './guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { email: string; password: string; institutionSlug: string },
  ) {
    return this.authService.login(body.email, body.password, body.institutionSlug);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() body: { refreshToken: string }) {
    return this.authService.logout(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('me')
  me(
    @CurrentUser() user: any,
    @Req() req: Request & { institution: any },
  ) {
    return this.authService.me(user.id, req.institution.slug);
  }
}