const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Order Schema - lưu thông tin giao dịch giữa người mua và người bán
 */
const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // người mua
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // người bán
      required: true,
      index: true,
    },
    listingId: {
      type: Schema.Types.ObjectId,
      ref: 'Listing', // tin đăng
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      required: true,
      enum: ['buy', 'sell'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Virtual field: xuất "id" thay vì "_id"
orderSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
orderSchema.set('toJSON', { virtuals: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
