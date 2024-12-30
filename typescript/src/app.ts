import { log } from "console";
import {
  authenticate,
  createOrder,
  getAccountInfo,
  getBalanceAccount,
  getOpenOrders,
  listAvailableMarkets,
  onboardUser,
} from "./utils/api";
import { Account, SystemConfig } from "./utils/types";
import { shortString } from "starknet";
import path from 'path';

const ccxt = require ('ccxt');
const moment = require('moment');
type BalanceResult = {
  token: string;
  size: string;
  last_updated_at: number;
};

type BalanceResponse = {
  results: BalanceResult[];
};
type Precision = {
  amount: number;
  price: number;
};

type Limits = {
  leverage: Record<string, unknown>;
  amount: Record<string, unknown>;
  price: Record<string, unknown>;
  cost: Record<string, unknown>;
};

type MarginModes = {
  cross: unknown;
  isolated: unknown;
};

type Info = {
  symbol: string;
  base_currency: string;
  quote_currency: string;
  settlement_currency: string;
  order_size_increment: string;
  price_tick_size: string;
  min_notional: string;
  open_at: string;
  expiry_at: string;
  asset_kind: string;
  market_kind: string;
  position_limit: string;
  price_bands_width: string;
  max_open_orders: string;
  max_funding_rate: string;
  delta1_cross_margin_params: Record<string, unknown>;
  price_feed_id: string;
  oracle_ewma_factor: string;
  max_order_size: string;
  max_funding_rate_change: string;
  max_tob_spread: string;
  interest_rate: string;
  clamp_rate: string;
};

interface Market {
  id: string;
  lowercaseId?: string;
  symbol: string;
  base: string;
  quote: string;
  settle: string;
  baseId: string;
  quoteId: string;
  settleId: string;
  type: string;
  spot: boolean;
  margin?: boolean;
  swap: boolean;
  future: boolean;
  option: boolean;
  index?: boolean;
  active?: boolean;
  contract: boolean;
  linear: boolean;
  inverse?: boolean;
  subType?: string;
  taker: number;
  maker: number;
  contractSize: number;
  expiry?: number;
  expiryDatetime?: string;
  strike?: number;
  optionType?: string;
  precision: Precision;
  limits: Limits;
  marginModes: MarginModes;
  created?: number;
  info: Info;
}
import { appendFile } from 'fs';
// Ghi dữ liệu vào file (đồng bộ)
function writeLog(logMessage: string): void {
  const logFilePath = 'log.txt'; // Đường dẫn file log
  const timestamp = new Date().toISOString(); // Thời gian hiện tại
  const logEntry = `[${timestamp}] ${logMessage}\n`; // Dòng log với timestamp

  // Ghi log nối thêm vào file (append)
  appendFile(logFilePath, logEntry, 'utf8', (err) => {
      if (err) {
          console.error('Error writing log:', err);
      } else {
          console.log('Log written successfully!');
      }
  });
}

// // Example usage of the Paradex API
(async () => {
  // TODO: Get from /system/config
  
  const apiBaseUrl = "https://api.testnet.paradex.trade/v1";
  const chainId = shortString.encodeShortString("PRIVATE_SN_POTC_SEPOLIA");
  const config: SystemConfig = {
    apiBaseUrl,
    starknet: { chainId },
  };

  // TODO: Add key derivation
  const symbol = "ETH-USD-PERP";

  const account: Account = {
    address:  "0x1ae6137723dc959e09b12573983fb91e7156b66ba04069fb503cd517d9f86a6",
    publicKey:  "0x448c286aef29d70e959fb79418fc8342d7d4115b6716adb5bf9c9202ed95c25",
    privateKey:  "0x62ba7bd641f05e90018ab29e71fa956cbf7620ec5740e5c6db4d3890140f67d",
    ethereumAccount: "0x1CCD3a92Fc7d01F058F7B2fdfb2c644400256052",
  };

  const executeTrade = async () => {
    try {
      //đăng nhập
      await onboardUser(config, account);
      account.jwtToken = await authenticate(config, account);
      // Lấy balance của tài khoản 
      const balance: BalanceResponse = await getBalanceAccount(config, account);
      const usdcBalance = parseFloat(
        balance.results.find((b: BalanceResult) => b.token === 'USDC')!.size
      );
          console.log("USDC Balance:", usdcBalance);
      // Lấy dữ liệu của mã
         let paradex  = new ccxt.paradex ();
         const markets: Market[] = await paradex.fetchMarkets();
         var marketInfo = markets.find(m => m.id === symbol);
         if (!marketInfo) {
          throw new Error(`Market information not found for symbol: ${symbol}`);
         }
         console.log(marketInfo);
        const price: [number, number, number, number, number, number][] = await paradex.fetchOHLCV(symbol,'1m',undefined, 5);
        const bprice = price.map((item: [number, number, number, number, number, number]) => {
          return {
            timestamp: moment(item[0]).format(),
            open: item[1],
            high: item[2],
            low: item[3],
            close: item[4],
            volume: item[5]
          };
        });
        console.log(bprice);
      // Thực hiện logic Trade (kiểm tra xem nếu như giá tăng so với giá trung bình cộng thì sẽ bán, còn nếu như giá nhỏ hơn thì sẽ mua)
              // Tính giá trung bình cộng (average price) từ giá đóng cửa (close)
              const averagePrice = bprice.reduce((sum, item) => sum + item.close, 0) / bprice.length;
              console.log('Average Price:', averagePrice);
  
              // Giá hiện tại (giá đóng cửa của nến mới nhất)
              const currentPrice = bprice[bprice.length - 1].close;
              console.log('Current Price:', currentPrice);
               // Tính kích thước giao dịch (size
  
  
                let size = 1000 / currentPrice; // Số lượng ETH để mua với 100 USDC
                const stepSize = marketInfo.precision.amount;
                size = Math.floor(size / stepSize) * stepSize;
                const requiredBalance = size * currentPrice; // Số tiền USDC cần thiết
                // Kiểm tra số dư USDC
                if (requiredBalance > usdcBalance) {
                  size = usdcBalance / currentPrice; // Điều chỉnh size để vừa với số dư
                }
                size = parseFloat(size.toFixed(stepSize.toString().split('.')[1].length));
                console.log('Calculated Size:', size);
              // Thực hiện logic giao dịch
              const side = (currentPrice > averagePrice) ? 'SELL' : 'BUY' 
      //tạo ra Order
      const exampleOrder = {
        market: symbol,                 
        side: side,                    
        type: "LIMIT",                  
        size: size.toString(),          
        price: currentPrice.toString(), 
        instruction: "GTC",             
      };
      await createOrder(config, account, exampleOrder);
      writeLog( `Trade executed: Symbol=${symbol}, Side=${side}, Price=${currentPrice}, Size=${size}, USDC Balance=${usdcBalance}`);
    } catch (error) {
      console.error("AppError:", error);
    }
  };
  executeTrade();
  setInterval(executeTrade, 60 * 1000);
})();
