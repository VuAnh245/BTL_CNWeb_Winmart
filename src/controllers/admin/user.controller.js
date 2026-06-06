const userService = require('../../services/user.service');

exports.list = async (req, res) => {
  try {
    const { search, role, status, page = 1 } = req.query;
    
    const filters = { is_active: 1 };
    if (search) filters.HoTen = { op: 'LIKE', value: `%${search}%` };
    if (role) filters.VaiTro = role;
    if (status) filters.TrangThai = status;

    const result = await userService.getAll(filters, { page, limit: 10 }, req.session.user.role);

    res.render('admin/users/index', {
      title: 'Quản lý Nhân Viên',
      users: result.items,
      meta: result.meta,
      filters: req.query,
      activeMenu: 'users',
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải danh sách nhân viên');
    res.redirect('/admin');
  }
};

exports.createForm = async (req, res) => {
  try {
    const page = 1;
    const result = await userService.getAll({ is_active: 1 }, { page, limit: 10 }, req.session.user.role);

    res.render('admin/users/index', {
      title: 'Thêm mới Nhân viên',
      users: result.items,
      meta: result.meta,
      filters: {},
      activeMenu: 'users',
      user: req.session.user,
      openSlideOver: true,
      editEmployee: null,
      old: req.session.old || {}
    });
    req.session.old = {};
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải danh sách nhân viên');
    res.redirect('/admin');
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    await userService.create(data, req.session.user.id);
    return res.json({ success: true, message: 'Thêm mới nhân viên thành công' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

exports.editForm = async (req, res) => {
  try {
    const employee = await userService.getById(req.params.id, req.session.user.id, req.session.user.role);
    if (!employee) {
      req.flash('error', 'Không tìm thấy nhân viên');
      return res.redirect('/admin/users');
    }

    const page = 1;
    const result = await userService.getAll({ is_active: 1 }, { page, limit: 10 }, req.session.user.role);

    res.render('admin/users/index', {
      title: 'Cập nhật Nhân viên',
      users: result.items,
      meta: result.meta,
      filters: {},
      activeMenu: 'users',
      user: req.session.user,
      openSlideOver: true,
      editEmployee: employee,
      old: req.session.old || {}
    });
    req.session.old = {};
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải form cập nhật');
    res.redirect('/admin/users');
  }
};

exports.update = async (req, res) => {
  try {
    await userService.update(req.params.id, req.body, req.session.user.id, req.session.user.role);
    return res.json({ success: true, message: 'Cập nhật nhân viên thành công' });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const result = await userService.softDelete(req.params.id, req.session.user.id, req.session.user.role);
    const msg = result.hardDeleted ? 'Đã xóa hoàn toàn nhân viên khỏi hệ thống' : 'Đã chuyển nhân viên sang trạng thái Đã Nghỉ Việc';
    return res.json({ success: true, message: msg });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
