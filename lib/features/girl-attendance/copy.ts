import type { Locale } from "@/lib/i18n"

type AttendanceCopy = {
  pageTitle: string
  pageDescription: string
  updateTrustScores: string
  updatingTrustScores: string
  bookingRateFormulaLabel: string
  bookingRateFormulaValue: string
  bookingRateFormulaHint: string
  searchPlaceholder: string
  cityPlaceholder: string
  allCities: string
  detailsTitle: string
  detailsDescription: (count: number) => string
  confirmTrustScoreUpdate: string
  trustScoreUpdateSuccess: (count: number) => string
  trustScoreUpdateError: string
  loadAttendanceError: string
  loadCitiesError: string
  adminRoleError: string
  table: {
    loading: string
    empty: string
    technician: string
    onlineHours: string
    completedOrders: string
    orderHours: string
    bookingRate: string
    extensionRate: string
    performanceRating: string
    actions: string
    jobNumber: string
    hours: string
    orders: string
    viewPerformance: string
    ratingLabels: Record<string, string>
  }
  dialog: {
    title: string
    description: (girlName: string, girlNumber: number) => string
    fallbackDescription: string
    empty: string
    performanceIndex: string
    windowDays: (days: number) => string
    generatedAt: string
    metrics: {
      bookingEfficiency: { label: string; note: string }
      extensionRate: { label: string; note: string }
      extraTimeTotal: { label: string; note: string }
      arrivedCancellation: { label: string; note: string }
      repeatClient: { label: string; note: string }
      favoriteGrowth: { label: string; note: string }
    }
    levelLabels: Record<"Excellent" | "Strong" | "Fair" | "Needs Attention", string>
    loadError: string
    noDate: string
    minute: string
    minutes: string
    hour: string
    hours: string
  }
}

const zhCopy: AttendanceCopy = {
  pageTitle: "技师考勤统计",
  pageDescription: "最近90天的技师在线时长、完成订单数、加钟率和预订率统计",
  updateTrustScores: "更新诚信分",
  updatingTrustScores: "更新中...",
  bookingRateFormulaLabel: "预订率计算：",
  bookingRateFormulaValue: "近90天标准订单时长 / 近90天在线时长 × 100%",
  bookingRateFormulaHint: "列表预订率与业绩弹窗预约效率使用同一套90天口径。",
  searchPlaceholder: "搜索技师名称或工号...",
  cityPlaceholder: "筛选城市",
  allCities: "全部城市",
  detailsTitle: "考勤明细",
  detailsDescription: (count) => `共 ${count} 位已认证技师，已排除被屏蔽技师`,
  confirmTrustScoreUpdate:
    "确定要根据考勤表现批量更新技师诚信分吗？\n\n此操作将基于最近90天的在线时长、加钟率和预订率对所有已认证技师的诚信分进行调整。",
  trustScoreUpdateSuccess: (count) => `诚信分更新成功，已更新 ${count} 位技师`,
  trustScoreUpdateError: "更新诚信分失败",
  loadAttendanceError: "加载考勤统计失败",
  loadCitiesError: "加载城市列表失败",
  adminRoleError: "检查管理员角色失败",
  table: {
    loading: "加载中...",
    empty: "暂无数据",
    technician: "技师",
    onlineHours: "在线时长 (h)",
    completedOrders: "完成订单",
    orderHours: "订单时长 (h)",
    bookingRate: "预订率",
    extensionRate: "加钟率",
    performanceRating: "绩效评级",
    actions: "操作",
    jobNumber: "工号",
    hours: "小时",
    orders: "单",
    viewPerformance: "查看业绩",
    ratingLabels: {
      excellent: "优质",
      good: "较强",
      average: "稳定",
      poor: "偏弱",
      very_poor: "需关注",
      insufficient_data: "数据不足",
      unknown: "未知",
    },
  },
  dialog: {
    title: "查看业绩",
    description: (girlName, girlNumber) => `${girlName} #${girlNumber} 的近 90 天业绩快照`,
    fallbackDescription: "技师业绩快照",
    empty: "暂无业绩数据",
    performanceIndex: "综合业绩指数",
    windowDays: (days) => `统计窗口：近 ${days} 天`,
    generatedAt: "生成时间",
    metrics: {
      bookingEfficiency: {
        label: "预约效率",
        note: "标准订单时长 / 在线时长",
      },
      extensionRate: {
        label: "加钟率",
        note: "完成订单中发生有效加钟的占比",
      },
      extraTimeTotal: {
        label: "加钟总时长",
        note: "历史累计有效加钟分钟数",
      },
      arrivedCancellation: {
        label: "到达后取消率",
        note: "该项会拉低综合业绩指数",
      },
      repeatClient: {
        label: "回头客率",
        note: "统计窗口内复购客户占比",
      },
      favoriteGrowth: {
        label: "收藏净增长",
        note: "收藏增加减去取消收藏",
      },
    },
    levelLabels: {
      Excellent: "优秀",
      Strong: "较强",
      Fair: "稳定",
      "Needs Attention": "需关注",
    },
    loadError: "获取业绩快照失败",
    noDate: "-",
    minute: "分钟",
    minutes: "分钟",
    hour: "小时",
    hours: "小时",
  },
}

const thCopy: AttendanceCopy = {
  pageTitle: "สถิติการเข้างานช่าง",
  pageDescription: "สรุปเวลาออนไลน์ จำนวนงานที่เสร็จ อัตราต่อเวลา และอัตราการจองย้อนหลัง 90 วัน",
  updateTrustScores: "อัปเดตคะแนนความน่าเชื่อถือ",
  updatingTrustScores: "กำลังอัปเดต...",
  bookingRateFormulaLabel: "สูตรอัตราการจอง:",
  bookingRateFormulaValue: "เวลางานมาตรฐาน 90 วัน / เวลาออนไลน์ 90 วัน × 100%",
  bookingRateFormulaHint: "อัตราการจองในรายการและประสิทธิภาพการจองในหน้าผลงานใช้เกณฑ์ 90 วันเดียวกัน",
  searchPlaceholder: "ค้นหาชื่อช่างหรือรหัส...",
  cityPlaceholder: "เลือกเมือง",
  allCities: "ทุกเมือง",
  detailsTitle: "รายละเอียดการเข้างาน",
  detailsDescription: (count) => `ช่างที่ยืนยันแล้ว ${count} คน ไม่รวมช่างที่ถูกปิดใช้งาน`,
  confirmTrustScoreUpdate:
    "ยืนยันอัปเดตคะแนนความน่าเชื่อถือของช่างตามผลงานการเข้างานใช่หรือไม่?\n\nระบบจะอ้างอิงเวลาออนไลน์ 90 วัน อัตราต่อเวลา และอัตราการจองเพื่อปรับคะแนนของช่างที่ยืนยันแล้วทั้งหมด",
  trustScoreUpdateSuccess: (count) => `อัปเดตคะแนนความน่าเชื่อถือแล้ว ${count} คน`,
  trustScoreUpdateError: "อัปเดตคะแนนความน่าเชื่อถือไม่สำเร็จ",
  loadAttendanceError: "โหลดสถิติการเข้างานไม่สำเร็จ",
  loadCitiesError: "โหลดรายชื่อเมืองไม่สำเร็จ",
  adminRoleError: "ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ",
  table: {
    loading: "กำลังโหลด...",
    empty: "ไม่มีข้อมูล",
    technician: "ช่าง",
    onlineHours: "เวลาออนไลน์ (h)",
    completedOrders: "งานที่เสร็จ",
    orderHours: "เวลางาน (h)",
    bookingRate: "อัตราการจอง",
    extensionRate: "อัตราต่อเวลา",
    performanceRating: "ระดับผลงาน",
    actions: "การทำงาน",
    jobNumber: "รหัส",
    hours: "ชม.",
    orders: "งาน",
    viewPerformance: "ดูผลงาน",
    ratingLabels: {
      excellent: "ดีมาก",
      good: "แข็งแรง",
      average: "คงที่",
      poor: "ค่อนข้างอ่อน",
      very_poor: "ต้องติดตาม",
      insufficient_data: "ข้อมูลไม่พอ",
      unknown: "ไม่ทราบ",
    },
  },
  dialog: {
    title: "ดูผลงาน",
    description: (girlName, girlNumber) => `สรุปผลงานย้อนหลัง 90 วันของ ${girlName} #${girlNumber}`,
    fallbackDescription: "สรุปผลงานช่าง",
    empty: "ยังไม่มีข้อมูลผลงาน",
    performanceIndex: "ดัชนีผลงานรวม",
    windowDays: (days) => `ช่วงสถิติ: ${days} วันล่าสุด`,
    generatedAt: "เวลาที่สร้าง",
    metrics: {
      bookingEfficiency: {
        label: "ประสิทธิภาพการจอง",
        note: "เวลางานมาตรฐาน / เวลาออนไลน์",
      },
      extensionRate: {
        label: "อัตราต่อเวลา",
        note: "สัดส่วนงานที่มีการต่อเวลาซึ่งมีผลจริง",
      },
      extraTimeTotal: {
        label: "เวลาต่อรวม",
        note: "จำนวนนาทีต่อเวลาที่มีผลสะสมทั้งหมด",
      },
      arrivedCancellation: {
        label: "อัตรายกเลิกหลังถึง",
        note: "ค่ายิ่งสูงยิ่งกดคะแนนรวมลง",
      },
      repeatClient: {
        label: "อัตราลูกค้าเดิม",
        note: "สัดส่วนลูกค้าที่กลับมาใช้ซ้ำในช่วงสถิติ",
      },
      favoriteGrowth: {
        label: "ยอดถูกใจสุทธิ",
        note: "จำนวนถูกใจเพิ่ม หักจำนวนยกเลิกถูกใจ",
      },
    },
    levelLabels: {
      Excellent: "ยอดเยี่ยม",
      Strong: "แข็งแรง",
      Fair: "คงที่",
      "Needs Attention": "ต้องติดตาม",
    },
    loadError: "โหลดสรุปผลงานไม่สำเร็จ",
    noDate: "-",
    minute: "นาที",
    minutes: "นาที",
    hour: "ชม.",
    hours: "ชม.",
  },
}

export function getGirlAttendanceCopy(locale: Locale): AttendanceCopy {
  return locale === "th" ? thCopy : zhCopy
}
