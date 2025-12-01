import { logger } from "@/utils/logger";

export interface IPInfo {
    ip: string;
    city: string;
    region: string;
    country: string;
    country_code: string;
    org: string;
    timezone: string;
    asn?: string | number;
}

export interface RiskAssessment {
    score: number;
    level: 'clean' | 'low' | 'medium' | 'high' | 'unknown';
    reasons: string[];
    isClean: boolean;
}

export interface NetworkStatus {
    tun: {
        detected: boolean;
        interfaces: string[];
    };
    ip: IPInfo | null;
    risk: RiskAssessment;
    type: 'residential' | 'datacenter' | 'vpn' | 'unknown';
    timestamp: string;
}

export class NetworkService {
    // Detect TUN interface using WebRTC
    static async detectTUN(): Promise<{ detected: boolean; interfaces: string[] }> {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            const localIPs = new Set<string>();
            let hasTUN = false;

            pc.createDataChannel('');
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .catch(() => { });

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) {
                    // Detection complete
                    setTimeout(() => {
                        pc.close();
                        resolve({
                            detected: hasTUN,
                            interfaces: Array.from(localIPs)
                        });
                    }, 1000);
                    return;
                }

                const candidateStr = ice.candidate.candidate;
                const ipMatch = candidateStr.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);

                if (ipMatch) {
                    const ip = ipMatch[0];
                    localIPs.add(ip);

                    // Check for TUN-like patterns
                    // TUN interfaces often use specific IP ranges
                    if (
                        ip.startsWith('10.') ||      // Common VPN range
                        ip.startsWith('172.') ||     // Private network
                        ip.startsWith('100.64.')     // CGNAT range used by some VPNs
                    ) {
                        hasTUN = true;
                    }
                }
            };
        });
    }

    // Get IP information from multiple sources
    static async getIPInfo(): Promise<IPInfo | null> {
        try {
            // Try primary API with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://ipapi.co/json/', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            logger.warn('Primary IP API failed', { error: String(error) });
        }

        try {
            // Fallback API - use HTTPS
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://ip-api.com/json/', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return {
                    ip: data.query,
                    city: data.city,
                    region: data.regionName,
                    country: data.country,
                    country_code: data.countryCode,
                    org: data.isp,
                    timezone: data.timezone
                };
            }
        } catch (error) {
            logger.warn('Fallback IP API failed', { error: String(error) });
        }

        // If both APIs fail, try to get basic info from a third source
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('https://api.ipify.org?format=json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return {
                    ip: data.ip,
                    city: 'Unknown',
                    region: 'Unknown',
                    country: 'Unknown',
                    country_code: 'XX',
                    org: 'Unknown ISP',
                    timezone: 'Unknown'
                };
            }
        } catch (error) {
            logger.error('All IP APIs failed', { error: String(error) });
        }

        return null;
    }

    // Assess IP risk score
    static assessRisk(ipInfo: IPInfo | null): RiskAssessment {
        if (!ipInfo) {
            return {
                score: 100,
                level: 'unknown',
                reasons: ['无法获取 IP 信息'],
                isClean: false
            };
        }

        let score = 0;
        const reasons: string[] = [];

        // Check for datacenter/hosting providers
        const datacenterKeywords = [
            'amazon', 'aws', 'google cloud', 'azure', 'digitalocean',
            'linode', 'vultr', 'ovh', 'hetzner', 'hosting', 'datacenter',
            'server', 'cloud', 'cogent'
        ];

        const org = (ipInfo.org || '').toLowerCase();
        const isDatacenter = datacenterKeywords.some(keyword => org.includes(keyword));

        if (isDatacenter) {
            score += 40;
            reasons.push('数据中心 IP');
        }

        // Check for VPN/Proxy keywords
        const vpnKeywords = ['vpn', 'proxy', 'tunnel', 'relay'];
        const isVPN = vpnKeywords.some(keyword => org.includes(keyword));

        if (isVPN) {
            score += 50;
            reasons.push('VPN/代理服务');
        }

        // Check ASN (if available)
        if (ipInfo.asn) {
            const asn = String(ipInfo.asn);
            // Known problematic ASNs (example list)
            const riskyASNs = ['15169', '16509', '14061']; // Google, Amazon, DigitalOcean
            if (riskyASNs.includes(asn)) {
                score += 20;
                reasons.push('高风险 ASN');
            }
        }

        // Determine risk level
        let level: RiskAssessment['level'];
        if (score === 0) {
            level = 'clean';
            reasons.push('住宅 IP');
        } else if (score < 30) {
            level = 'low';
        } else if (score < 60) {
            level = 'medium';
        } else {
            level = 'high';
        }

        return {
            score,
            level,
            reasons,
            isClean: score < 30
        };
    }

    // Determine IP type
    static getIPType(ipInfo: IPInfo | null, riskAssessment: RiskAssessment): NetworkStatus['type'] {
        if (!ipInfo) return 'unknown';

        if (riskAssessment.reasons.includes('VPN/代理服务')) {
            return 'vpn';
        }

        if (riskAssessment.reasons.includes('数据中心 IP')) {
            return 'datacenter';
        }

        return 'residential';
    }

    // Get comprehensive network status
    static async getNetworkStatus(): Promise<NetworkStatus> {
        const tunStatus = await this.detectTUN();
        const ipInfo = await this.getIPInfo();
        const riskAssessment = this.assessRisk(ipInfo);
        const ipType = this.getIPType(ipInfo, riskAssessment);

        return {
            tun: tunStatus,
            ip: ipInfo,
            risk: riskAssessment,
            type: ipType,
            timestamp: new Date().toISOString()
        };
    }
}
