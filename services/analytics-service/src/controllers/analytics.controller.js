
// src/controllers/analytics.controller.js
const DailyStats = require('../models/DailyStats.model');
const moment = require('moment');

// Lấy số liệu thống kê tổng hợp (Chỉ Admin)
exports.getStatsSummary = async (req, res) => {
    // ⚠️ Đã kiểm tra quyền Admin qua adminMiddleware
    try {
        // Lấy số liệu trong 30 ngày gần nhất
        const days = parseInt(req.query.days) || 30;
        const endDate = moment().endOf('day').toDate();
        const startDate = moment().subtract(days - 1, 'days').startOf('day').toDate();

        const data = await DailyStats.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Tính tổng hợp 
        const summary = data.reduce((acc, curr) => {
            acc.totalNewUsers += curr.newUsers;
            acc.totalNewListings += curr.newListings;
            acc.totalRevenue += curr.totalRevenue;
            acc.totalCommission += curr.totalCommission;
            acc.totalTransactions += curr.totalTransactions;
            return acc;
        }, {
            totalNewUsers: 0,
            totalNewListings: 0,
            totalRevenue: 0,
            totalCommission: 0,
            totalTransactions: 0,
        });

        res.status(200).json({
            success: true,
            period: `${days} days`,
            summary: summary,
            dailyData: data,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};