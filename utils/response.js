function success(res, data = {}, message = null, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, data: null, message });
}

module.exports = { success, fail };
