import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from './guards/tenant.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { TenantRequest } from '../../common/interfaces/tenant-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.authService.login(
      body.email,
      body.password,
      body.institutionSlug,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser, @Req() req: TenantRequest) {
    if (!req.institution) {
      return this.authService.me(user.id, user.institutionSlug);
    }

    return this.authService.me(user.id, req.institution.slug);
  }
}
