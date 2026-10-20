import { All, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import * as auth from '@nanda/core/endpoints/auth'
import * as me from '@nanda/core/endpoints/me'
import * as admin from '@nanda/core/endpoints/admin'
import * as summary from '@nanda/core/endpoints/profile-summary'
import * as quests from '@nanda/core/endpoints/quests'
import * as levels from '@nanda/core/endpoints/levels'
import * as shop from '@nanda/core/endpoints/shop'
import * as shopWebhook from '@nanda/core/endpoints/shop-webhook'
import * as shopStars from '@nanda/core/endpoints/shop-telegram'
import * as push from '@nanda/core/endpoints/push'
import * as adminImage from '@nanda/core/endpoints/admin-image'
import * as adminShots from '@nanda/core/endpoints/admin-shots'
import * as challenge from '@nanda/core/endpoints/challenge'
import * as duel from '@nanda/core/endpoints/duel'
import * as entitiesEndpoint from '@nanda/core/endpoints/entities'
import * as pair from '@nanda/core/endpoints/pair'
import * as shot from '@nanda/core/endpoints/shot'
import * as tune from '@nanda/core/endpoints/tune'
import * as tuneAudio from '@nanda/core/endpoints/tune-audio'
import * as shotImage from '@nanda/core/endpoints/shot-image'
import * as meta from '@nanda/core/endpoints/meta'
import * as achievements from '@nanda/core/endpoints/achievements'
import * as awards from '@nanda/core/endpoints/awards'
import * as friends from '@nanda/core/endpoints/friends'
import * as avatar from '@nanda/core/endpoints/avatar'
import * as leaderboard from '@nanda/core/endpoints/leaderboard'
import * as seasonBoard from '@nanda/core/endpoints/season'
import * as profile from '@nanda/core/endpoints/profile'
import * as roundCurrent from '@nanda/core/endpoints/round-current'
import * as roundGuess from '@nanda/core/endpoints/round-guess'
import * as roundGiveup from '@nanda/core/endpoints/round-giveup'
import * as roundImage from '@nanda/core/endpoints/round-image'
import * as roundVoice from '@nanda/core/endpoints/round-voice'
import { bridge, toWebRequest } from './web-bridge'
import { currentUser } from '@nanda/core/profile'
import { subscribeBell, subscribeDuel, type Sender } from '@nanda/core/stream'

const KEEP_ALIVE_MS = 25_000

function openStream(req: Request, res: Response): Sender {
  res.status(200)
  res.setHeader('content-type', 'text/event-stream; charset=utf-8')
  res.setHeader('cache-control', 'no-cache, no-transform')
  res.setHeader('connection', 'keep-alive')
  res.setHeader('x-accel-buffering', 'no')
  res.flushHeaders()

  const beat = setInterval(() => res.write(': beat\n\n'), KEEP_ALIVE_MS)
  req.on('close', () => clearInterval(beat))

  return (event, data) => {
    if (res.writableEnded) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
}

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

  @Get('push')
  pushState(@Req() req: Request, @Res() res: Response) {
    return bridge(push.GET, req, res)
  }

  @Post('push')
  pushSave(@Req() req: Request, @Res() res: Response) {
    return bridge(push.POST, req, res)
  }

  @Post('challenge')
  challenges(@Req() req: Request, @Res() res: Response) {
    return bridge(challenge.POST, req, res)
  }

  @Post('duel')
  duels(@Req() req: Request, @Res() res: Response) {
    return bridge(duel.POST, req, res)
  }

  @Get('admin/entities')
  adminList(@Req() req: Request, @Res() res: Response) {
    return bridge(admin.GET, req, res)
  }

  @Post('admin/entity')
  adminSave(@Req() req: Request, @Res() res: Response) {
    return bridge(admin.POST, req, res)
  }

  @Post('admin/image')
  adminImage(@Req() req: Request, @Res() res: Response) {
    return bridge(adminImage.POST, req, res)
  }

  @Get('admin/shots')
  adminShots(@Req() req: Request, @Res() res: Response) {
    return bridge(adminShots.GET, req, res)
  }

  @Post('admin/shots/frame')
  adminShotUpload(@Req() req: Request, @Res() res: Response) {
    return bridge(adminShots.UPLOAD, req, res)
  }

  @Post('admin/shots/drop')
  adminShotDrop(@Req() req: Request, @Res() res: Response) {
    return bridge(adminShots.DROP, req, res)
  }

  @Get('shop')
  shopPacks(@Req() req: Request, @Res() res: Response) {
    return bridge(shop.GET, req, res)
  }

  @Post('shop/checkout')
  shopCheckout(@Req() req: Request, @Res() res: Response) {
    return bridge(shop.POST, req, res)
  }

  @Post('shop/webhook')
  shopWebhook(@Req() req: Request, @Res() res: Response) {
    return bridge(shopWebhook.POST, req, res)
  }

  @Post('shop/telegram')
  shopStars(@Req() req: Request, @Res() res: Response) {
    return bridge(shopStars.POST, req, res)
  }

  @Get('quests')
  questBoard(@Req() req: Request, @Res() res: Response) {
    return bridge(quests.GET, req, res)
  }

  @Post('quests/claim')
  questClaim(@Req() req: Request, @Res() res: Response) {
    return bridge(quests.POST, req, res)
  }

  @Get('levels')
  levelBoard(@Req() req: Request, @Res() res: Response) {
    return bridge(levels.GET, req, res)
  }

  @Post('levels/claim')
  levelClaim(@Req() req: Request, @Res() res: Response) {
    return bridge(levels.POST, req, res)
  }

  @Get('profile/summary')
  profileSummary(@Req() req: Request, @Res() res: Response) {
    return bridge(summary.GET, req, res)
  }

  @Post('admin/settings')
  adminSettings(@Req() req: Request, @Res() res: Response) {
    return bridge(admin.SETTINGS, req, res)
  }

  @Get('meta')
  meta(@Req() req: Request, @Res() res: Response) {
    return bridge(meta.GET, req, res)
  }

  @Get('entities')
  entities(@Req() req: Request, @Res() res: Response) {
    return bridge(entitiesEndpoint.GET, req, res)
  }

  @Get('achievements')
  achievements(@Req() req: Request, @Res() res: Response) {
    return bridge(achievements.GET, req, res)
  }

  @Post('profile/avatar')
  avatarSave(@Req() req: Request, @Res() res: Response) {
    return bridge(avatar.POST, req, res)
  }

  @Get('friends')
  friendsList(@Req() req: Request, @Res() res: Response) {
    return bridge(friends.GET, req, res)
  }

  @Post('friends')
  friendsAct(@Req() req: Request, @Res() res: Response) {
    return bridge(friends.POST, req, res)
  }

  @Get('awards')
  awards(@Req() req: Request, @Res() res: Response) {
    return bridge(awards.GET, req, res)
  }

  @Post('achievements')
  pinAchievements(@Req() req: Request, @Res() res: Response) {
    return bridge(achievements.POST, req, res)
  }

  @Get('leaderboard')
  board(@Req() req: Request, @Res() res: Response) {
    return bridge(leaderboard.GET, req, res)
  }

  @Get('season')
  season(@Req() req: Request, @Res() res: Response) {
    return bridge(seasonBoard.GET, req, res)
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

  @Get('round/voice')
  voice(@Req() req: Request, @Res() res: Response) {
    return bridge(roundVoice.GET, req, res)
  }

  @Get('round/image')
  image(@Req() req: Request, @Res() res: Response) {
    return bridge(roundImage.GET, req, res)
  }

  @Post('pair')
  pairRound(@Req() req: Request, @Res() res: Response) {
    return bridge(pair.POST, req, res)
  }

  @Post('shot')
  shotRound(@Req() req: Request, @Res() res: Response) {
    return bridge(shot.POST, req, res)
  }

  @Get('shot/image')
  shotPicture(@Req() req: Request, @Res() res: Response) {
    return bridge(shotImage.GET, req, res)
  }

  @Post('tune')
  tuneRound(@Req() req: Request, @Res() res: Response) {
    return bridge(tune.POST, req, res)
  }

  @Get('tune/audio')
  tuneSound(@Req() req: Request, @Res() res: Response) {
    return bridge(tuneAudio.GET, req, res)
  }

  @Get('stream/duel')
  async duelStream(@Req() req: Request, @Res() res: Response) {
    const code = typeof req.query.code === 'string' ? req.query.code.toUpperCase() : ''
    if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'bad_request' })
    const found = await currentUser(toWebRequest(req))
    if (!found) return res.status(401).json({ error: 'unauthorized' })
    const send = openStream(req, res)
    const stop = await subscribeDuel(code, found.doc._id!, send)
    req.on('close', stop)
  }

  @Get('stream/notify')
  async notifyStream(@Req() req: Request, @Res() res: Response) {
    const found = await currentUser(toWebRequest(req))
    if (!found) return res.status(401).json({ error: 'unauthorized' })
    const send = openStream(req, res)
    const stop = subscribeBell(found.doc._id!, send)
    req.on('close', stop)
  }
}
