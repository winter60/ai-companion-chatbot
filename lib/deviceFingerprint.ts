"use client"

/**
 * Device Fingerprinting Utility
 * 生成基于浏览器特征的设备指纹，用于更准确的访客识别
 */

export interface DeviceFingerprint {
  userAgent: string
  screen: string
  timezone: number
  language: string
  platform: string
  colorDepth: number
  cookieEnabled: boolean
  doNotTrack: string | null
  canvas: string
  webgl: string
  fonts: string
  timestamp: number
}

/**
 * 生成Canvas指纹
 */
function generateCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'no-canvas'
    
    // 设置canvas内容
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Device fingerprint 🔐', 2, 2)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('AI Companion', 4, 15)
    
    return canvas.toDataURL().slice(-50) // 只取最后50个字符
  } catch (error) {
    return 'canvas-error'
  }
}

/**
 * 生成WebGL指纹
 */
function generateWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return 'no-webgl'
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      return `${vendor}_${renderer}`.replace(/\s+/g, '_').substring(0, 30)
    }
    
    return gl.getParameter(gl.VERSION).replace(/\s+/g, '_').substring(0, 20)
  } catch (error) {
    return 'webgl-error'
  }
}

/**
 * 检测系统字体
 */
function generateFontsFingerprint(): string {
  try {
    const testFonts = [
      'Arial', 'Times', 'Helvetica', 'Courier', 'Verdana', 'Georgia',
      'Palatino', 'Garamond', 'Bookman', 'Tahoma', 'Impact', 'Comic Sans MS'
    ]
    
    const baseFonts = ['monospace', 'sans-serif', 'serif']
    const testString = 'mmmmmmmmmmlli'
    const testSize = '72px'
    const h = document.getElementsByTagName('body')[0]
    
    // 创建基准测试元素
    const baselineSpans: { [key: string]: HTMLSpanElement } = {}
    baseFonts.forEach(baseFont => {
      const s = document.createElement('span')
      s.style.fontSize = testSize
      s.style.fontFamily = baseFont
      s.textContent = testString
      s.style.position = 'absolute'
      s.style.left = '-9999px'
      h.appendChild(s)
      baselineSpans[baseFont] = s
    })
    
    // 测试目标字体
    const detected: string[] = []
    testFonts.forEach(testFont => {
      baseFonts.forEach(baseFont => {
        const s = document.createElement('span')
        s.style.fontSize = testSize
        s.style.fontFamily = `${testFont}, ${baseFont}`
        s.textContent = testString
        s.style.position = 'absolute'
        s.style.left = '-9999px'
        h.appendChild(s)
        
        const matched = s.offsetWidth !== baselineSpans[baseFont].offsetWidth ||
                       s.offsetHeight !== baselineSpans[baseFont].offsetHeight
        
        h.removeChild(s)
        
        if (matched) {
          detected.push(testFont)
          return // 找到匹配就跳出内层循环
        }
      })
    })
    
    // 清理基准元素
    baseFonts.forEach(baseFont => {
      h.removeChild(baselineSpans[baseFont])
    })
    
    return detected.slice(0, 5).join(',') || 'no-fonts'
  } catch (error) {
    return 'fonts-error'
  }
}

/**
 * 收集设备指纹信息
 */
export function collectDeviceFingerprint(): DeviceFingerprint {
  const fingerprint: DeviceFingerprint = {
    userAgent: navigator.userAgent,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: new Date().getTimezoneOffset(),
    language: navigator.language,
    platform: navigator.platform,
    colorDepth: screen.colorDepth,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    canvas: generateCanvasFingerprint(),
    webgl: generateWebGLFingerprint(),
    fonts: generateFontsFingerprint(),
    timestamp: Date.now()
  }
  
  return fingerprint
}

/**
 * 生成设备ID
 */
export function generateDeviceId(fingerprint?: DeviceFingerprint): string {
  const fp = fingerprint || collectDeviceFingerprint()
  
  // 创建指纹字符串
  const fingerprintString = JSON.stringify({
    userAgent: fp.userAgent.substring(0, 100), // 限制长度
    screen: fp.screen,
    timezone: fp.timezone,
    language: fp.language,
    platform: fp.platform,
    colorDepth: fp.colorDepth,
    cookieEnabled: fp.cookieEnabled,
    canvas: fp.canvas,
    webgl: fp.webgl,
    fonts: fp.fonts.substring(0, 50) // 限制长度
  })
  
  // 生成哈希值（简单的哈希函数）
  let hash = 0
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  
  // 转换为正数并生成字符串ID
  const deviceId = Math.abs(hash).toString(36).padStart(8, '0')
  
  return `guest_${deviceId}`
}

/**
 * 获取或创建持久化的设备ID
 */
export function getOrCreateGuestDeviceId(): string {
  const STORAGE_KEY = 'ai_companion_guest_device_id'
  const FINGERPRINT_KEY = 'ai_companion_device_fingerprint'
  const CREATION_TIME_KEY = 'ai_companion_device_created'
  
  try {
    // 检查localStorage是否可用
    if (typeof localStorage === 'undefined') {
      // 如果localStorage不可用，使用会话临时ID
      const sessionKey = '_temp_device_id'
      if (!(window as any)[sessionKey]) {
        (window as any)[sessionKey] = generateDeviceId()
      }
      return (window as any)[sessionKey]
    }
    
    const existingId = localStorage.getItem(STORAGE_KEY)
    const existingFingerprint = localStorage.getItem(FINGERPRINT_KEY)
    const creationTime = localStorage.getItem(CREATION_TIME_KEY)
    
    // 收集当前指纹
    const currentFingerprint = collectDeviceFingerprint()
    const currentFingerprintString = JSON.stringify(currentFingerprint)
    
    // 如果已存在ID且指纹匹配（允许小幅变化），直接返回
    if (existingId && existingFingerprint) {
      try {
        const stored = JSON.parse(existingFingerprint)
        // 检查关键特征是否匹配
        const keyMatches = 
          stored.screen === currentFingerprint.screen &&
          stored.language === currentFingerprint.language &&
          stored.platform === currentFingerprint.platform &&
          Math.abs(stored.timezone - currentFingerprint.timezone) <= 60 // 允许时区1小时差异
        
        if (keyMatches) {
          return existingId
        }
      } catch (error) {
        // 指纹解析失败，继续创建新的
      }
    }
    
    // 生成新的设备ID
    const newDeviceId = generateDeviceId(currentFingerprint)
    
    // 存储到localStorage
    localStorage.setItem(STORAGE_KEY, newDeviceId)
    localStorage.setItem(FINGERPRINT_KEY, currentFingerprintString)
    localStorage.setItem(CREATION_TIME_KEY, Date.now().toString())
    
    return newDeviceId
    
  } catch (error) {
    console.error('Error generating device ID:', error)
    // 降级方案：使用时间戳+随机数
    return `guest_fallback_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
  }
}

/**
 * 获取设备信息摘要（用于调试）
 */
export function getDeviceInfo(): { deviceId: string; fingerprint: DeviceFingerprint } {
  const fingerprint = collectDeviceFingerprint()
  const deviceId = generateDeviceId(fingerprint)
  
  return { deviceId, fingerprint }
}

/**
 * 清理设备ID（用于测试或重置）
 */
export function clearGuestDeviceId(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ai_companion_guest_device_id')
      localStorage.removeItem('ai_companion_device_fingerprint')
      localStorage.removeItem('ai_companion_device_created')
    }
    
    // 清理会话临时ID
    if (typeof window !== 'undefined') {
      delete (window as any)._temp_device_id
    }
  } catch (error) {
    console.error('Error clearing device ID:', error)
  }
}