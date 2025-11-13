// controllers/orderController.js
const TransactionUtil = require('../utils/Transaction');
const pdfGenerator = require('../utils/pdfGenerator');
const axios = require('axios');
const mongoose = require('mongoose');

/**
 * Tạo Đơn hàng (An toàn)
 * (Hàm này của bạn đã SỬA ĐÚNG - Giữ nguyên)
 */
const createOrder = async (req, res) => {
  try {
    const { listingId, type } = req.body;
    const userId = req.user._id; // Lấy từ middleware (an toàn)

    if (!listingId || !type) {
      return res.status(400).json({ success: false, error: 'Thiếu listingId hoặc type' });
    }
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ success: false, error: 'Listing ID không hợp lệ' });
    }

    // 1. Gọi nội bộ sang Listing Service
    let listingInfo;
    try {
      const token = req.headers.authorization;
      const listingServiceUrl = process.env.LISTING_SERVICE_URL || 'http://backend-listing-service-1:5000';

      const response = await axios.get(`${listingServiceUrl}/${listingId}`, {
        headers: { Authorization: token }
      });

      listingInfo = response.data.data || response.data;

    } catch (err) {
      console.error('Lỗi khi gọi Listing service:', err.message);
      if (err.response) {
        console.error('Listing Service Response:', err.response.data);
        return res.status(err.response.status).json({
          success: false,
          error: `Listing service trả về lỗi ${err.response.status}: ${err.response.data?.message || err.message}`
        });
      }
      return res.status(404).json({ success: false, error: 'Không tìm thấy Listing hoặc Listing service bị lỗi' });
    }

    // 2. Trích xuất thông tin Price và SellerId
    if (!listingInfo) {
      console.error('Data từ Listing service là rỗng hoặc undefined.');
      return res.status(500).json({
        success: false,
        error: 'Không thể lấy được thông tin từ Listing service (data rỗng).'
      });
    }

    const price = listingInfo.price;
    let sellerId = listingInfo.user_id || listingInfo.sellerId || listingInfo.userId;

    if (!sellerId && listingInfo.user) {
      if (typeof listingInfo.user === 'object' && listingInfo.user._id) {
        sellerId = listingInfo.user._id;
      } else if (typeof listingInfo.user === 'string') {
        sellerId = listingInfo.user;
      }
    }

    // KIỂM TRA AN TOÀN:
    if (!price || price <= 0 || !sellerId) {
      console.error('Data từ Listing service không hợp lệ (Thiếu Price hoặc SellerId):', listingInfo);
      return res.status(500).json({
        success: false,
        error: 'Không thể xác định Price hoặc SellerId từ Listing service (format data sai).'
      });
    }

    // 3. Kiểm tra logic nghiệp vụ
    if (userId.toString() === sellerId.toString()) {
      return res.status(400).json({ success: false, error: 'Bạn không thể tự mua tin đăng của mình.' });
    }

    // 4. Tạo đơn hàng
    // (Code này của bạn đã SỬA ĐÚNG)
    const order = await TransactionUtil.createNew(
      userId.toString(), // 1. userId (phải là string)
      sellerId,          // 2. sellerId (đã là string)
      listingId,         // 3. listingId (đã là string)
      parseFloat(price), // 4. price
      type               // 5. type
    );

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    if (error.name === 'ValidationError' || error.message.includes('Type phải là')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Xử lý Thanh toán (Admin hoặc Người mua)
 * (Hàm này của bạn đã ĐÚNG - Giữ nguyên)
 * (Lỗi 400 là hành vi đúng nếu đơn hàng không ở trạng thái 'pending')
 */
const processPayment = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id;

    const order = await TransactionUtil.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied. Bạn không phải người mua.' });
    }

    const updatedOrder = await TransactionUtil.markAsPaid(id);

    // === GỌI SANG LISTING SERVICE ===
    try {
      const listingId = updatedOrder.listingId;
      const token = req.headers.authorization;
      const listingServiceUrl = process.env.LISTING_SERVICE_URL || 'http://backend-listing-service-1:5000';

      console.log(`[TransactionService] Thanh toán ${id} thành công. Bắt đầu cập nhật Listing ${listingId}...`);

      // Cần đảm bảo Listing Service có route: PUT /:id/status
      // Và Model Listing chấp nhận status 'Sold'
      await axios.put(
        `${listingServiceUrl}/${listingId}/status`,
        { status: 'Sold' },
        { headers: { Authorization: token } }
      );

      console.log(`[TransactionService] Đã cập nhật Listing ${listingId} thành công.`);

    } catch (listingError) {
      console.error(`[TransactionService] LỖI NGHIÊM TRỌNG: Thanh toán ${id} THÀNH CÔNG, nhưng FAILED khi cập nhật status cho Listing ${updatedOrder.listingId}.`);
      console.error(listingError.message);
    }
    // === KẾT THÚC GỌI ===

    res.json({ success: true, order: updatedOrder });

  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * Xuất Hợp đồng (Admin, Người mua, Người bán)
 * === ĐÃ SỬA: Thay thế .populate() bằng các lệnh gọi API (axios) ===
 */
const generateContract = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user._id.toString();
    const userRole = req.user.role;
    const token = req.headers.authorization; // Lấy token để gọi service khác

    // 1. Lấy Transaction thô (raw) (không populate)
    const order = await TransactionUtil.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng' });
    }

    // 2. Kiểm tra quyền
    const isBuyer = order.userId.toString() === userId;
    const isSeller = order.sellerId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    if (order.status !== 'paid') {
      return res.status(400).json({ success: false, error: 'Đơn hàng phải được thanh toán mới có thể xuất hợp đồng' });
    }

    // 3. === BẮT ĐẦU SỬA: Lấy dữ liệu từ các service khác ===
    // (Thay thế cho TransactionUtil.findByIdPopulated)

    // Lấy URL từ biến môi trường (Giả định URL của User Service)
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://backend-auth-service-1:3000';
    const listingServiceUrl = process.env.LISTING_SERVICE_URL || 'http://backend-listing-service-1:5000';

    // Gọi API song song, thêm .catch() để tránh 1 lỗi làm hỏng toàn bộ
    const [buyerRes, sellerRes, listingRes] = await Promise.all([
      axios.get(`${userServiceUrl}/userprofile/${order.userId}`, { headers: { Authorization: token } }).catch(e => ({ data: null })),
      axios.get(`${userServiceUrl}/seller/${order.sellerId}`, { headers: { Authorization: token } }).catch(e => ({ data: null })),
      axios.get(`${listingServiceUrl}/${order.listingId}`, { headers: { Authorization: token } }).catch(e => ({ data: null })),


    ]);
    console.log('buyerRes:', buyerRes.data);
    console.log('sellerRes:', sellerRes.data);
    console.log('listingRes:', listingRes.data);
    // Gộp dữ liệu lại thành đối tượng 'populatedOrder'F
    const populatedOrder = {
      ...order.toObject(),
      id: order.id,
      userId: buyerRes.data
        ? { _id: buyerRes.data._id, profile: { username: buyerRes.data.username, email: buyerRes.data.email, phonenumber: buyerRes.data.phonenumber } }
        : { _id: order.userId, profile: { username: 'User Bị Lỗi', email: 'N/A', phonenumber: 'N/A' } },

      sellerId: sellerRes.data
        ? { _id: sellerRes.data.user_id || sellerRes.data._id, profile: { username: sellerRes.data.username, email: sellerRes.data.email, phonenumber: sellerRes.data.phonenumber } }
        : { _id: order.sellerId, profile: { username: 'User Bị Lỗi', email: 'N/A', phonenumber: 'N/A' } },

      listingId: listingRes.data
        ? { _id: listingRes.data._id, title: listingRes.data.title }
        : { _id: order.listingId, title: 'Tin đăng Bị Lỗi' }
    };
    // === KẾT THÚC SỬA ===

    pdfGenerator.generate(res, populatedOrder); // Hàm này sẽ stream PDF về client
  } catch (error) {
    console.error('Generate contract error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Lấy Lịch sử Giao dịch CÁ NHÂN
 * === ĐÃ SỬA: Lỗi "Invalid ObjectId" ===
 */
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user._id; // Chỉ lấy của user đã login

    // === SỬA LỖI: Thêm .toString() ===
    // userId ở đây là [object Object], phải chuyển thành string
    const history = await TransactionUtil.findHistoryByUserId(userId.toString());

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Get order history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


module.exports = {
  createOrder,
  processPayment,
  generateContract,
  getOrderHistory,
};