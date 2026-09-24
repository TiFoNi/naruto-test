import { All, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import * as auth from '@nanda/core/endpoints/auth'
import * as me from '@nanda/core/endpoints/me'
import * as challenge from '@nanda/core/endpoints/challenge'
import * as duel from '@nanda/core/endpoints/duel'
import * as entitiesEndpoint from '@nanda/core/endpoints/entities'
import * as leaderboard from '@nanda/core/endpoints/leaderboard'
import * as profile from '@nanda/core/endpoints/profile'
import * as roundCurrent from '@nanda/core/endpoints/round-current'
import * as roundGuess from '@nanda/core/endpoints/round-guess'
import * as roundGiveup from '@nanda/core/endpoints/round-giveup'
import * as roundImage from '@nanda/core/endpoints/round-image'
import { bridge } from './web-bridge'

@Controller('api')
export class GameController {
  @Get('me')
  profileOf(@Req() req: Request, @Res() res: Response) {
    return bridge(me.GET, req, res)
  }

  @All('auth/*path')
  authRoutes(@Req() req: Request, @Res() res: Response) {
    return bridge(req.method === 'GET' ? auth.GET : auth.POST, req, res)
  }

  @Post('challenge')
  challenges(@Req() req: Request, @Res() res: Response) {
    return bridge(challenge.POST, req, res)
  }

  @Post('duel')
  duels(@Req() req: Request, @Res() res: Response) {
    return bridge(duel.POST, req, res)
  }

  @Get('entities')
  entities(@Req() req: Request, @Res() res: Response) {
    return bridge(entitiesEndpoint.GET, req, res)
  }

  @Get('leaderboard')
  board(@Req() req: Request, @Res() res: Response) {
    return bridge(leaderboard.GET, req, res)
  }

  @Post('profile')
  updateProfile(@Req() req: Request, @Res() res: Response) {
    return bridge(profile.POST, req, res)
  }

  @Post('round/current')
  currentRound(@Req() req: Request, @Res() res: Response) {
    return bridge(roundCurrent.POST, req, res)
  }

  @Post('round/guess')
  guess(@Req() req: Request, @Res() res: Response) {
    return bridge(roundGuess.POST, req, res)
  }

  @Post('round/giveup')
  giveUp(@Req() req: Request, @Res() res: Response) {
    return bridge(roundGiveup.POST, req, res)
  }

  @Get('round/image')
  image(@Req() req: Request, @Res() res: Response) {
    return bridge(roundImage.GET, req, res)
  }
}
