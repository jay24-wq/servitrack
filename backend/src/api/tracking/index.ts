import { Router, Request, Response } from 'express';
import { getTrackingByCode } from '@repositories/trackingRepo';

export const trackingRouter = Router();

// GET /api/tracking/:trackingCode - Tracking publik memakai nomor resi customer
trackingRouter.get('/:trackingCode', async (req: Request, res: Response) => {
  try {
    const tracking = await getTrackingByCode(req.params.trackingCode);
    if (!tracking) {
      res.status(404).json({ error: 'Nomor resi tidak ditemukan' });
      return;
    }
    res.json(tracking);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil data tracking' });
  }
});
