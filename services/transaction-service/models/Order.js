const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Định nghĩa cấu trúc (Schema) cho Order
 *
 * Mongoose Schema sẽ map (ánh xạ) sang một Collection trong MongoDB.
 */
const orderSchema = new Schema(
  {
    // Không cần định nghĩa 'id', Mongoose tự động thêm trường '_id'
    // duy nhất cho mỗi document.

    userId: {
      type: Schema.Types.ObjectId, // Kiểu dữ liệu tham chiếu đến ID của document khác
      ref: 'User', // Tên của Model được tham chiếu (ví dụ: 'User')
      required: true,
      index: true, // Thêm index để tăng tốc độ truy vấn theo userId
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item', // Tên của Model được tham chiếu (ví dụ: 'Item')
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0, // Đảm bảo giá không bị âm
    },
    type: {
      type: String,
      required: true,
      enum: ['buy', 'sell'], // Giới hạn các giá trị hợp lệ (ví dụ)
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'cancelled'], // Các trạng thái đơn hàng
      default: 'pending', // Giá trị mặc định khi tạo mới
      index: true,
    },

  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;