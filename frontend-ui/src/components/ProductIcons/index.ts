import type { FC } from 'react';
import type { IconProps } from './types';
import { TShirtIcon } from './TShirtIcon';
import { TShirtPremiumIcon } from './TShirtPremiumIcon';
import { TShirtHeavyweightIcon } from './TShirtHeavyweightIcon';
import { VNeckIcon } from './VNeckIcon';
import { TankTopIcon } from './TankTopIcon';
import { LongSleeveIcon } from './LongSleeveIcon';
import { RaglanIcon } from './RaglanIcon';
import { SweatshirtIcon } from './SweatshirtIcon';
import { HoodiePulloverIcon } from './HoodiePulloverIcon';
import { HoodieZipIcon } from './HoodieZipIcon';
import { PerformanceIcon } from './PerformanceIcon';
import { BaseballIcon } from './BaseballIcon';
import { TruckerHatIcon } from './TruckerHatIcon';
import { PopSocketIcon } from './PopSocketIcon';
import { PhoneCaseIcon } from './PhoneCaseIcon';
import { ThrowPillowIcon } from './ThrowPillowIcon';
import { ToteBagIcon } from './ToteBagIcon';
import { TumblerIcon } from './TumblerIcon';
import { MugIcon } from './MugIcon';
import { WaterBottleIcon } from './WaterBottleIcon';

export type { IconProps } from './types';

export {
  TShirtIcon,
  TShirtPremiumIcon,
  TShirtHeavyweightIcon,
  VNeckIcon,
  TankTopIcon,
  LongSleeveIcon,
  RaglanIcon,
  SweatshirtIcon,
  HoodiePulloverIcon,
  HoodieZipIcon,
  PerformanceIcon,
  BaseballIcon,
  TruckerHatIcon,
  PopSocketIcon,
  PhoneCaseIcon,
  ThrowPillowIcon,
  ToteBagIcon,
  TumblerIcon,
  MugIcon,
  WaterBottleIcon,
};

// Keys mirror MBA_PRODUCT_CATALOG[*].icon_key (django-app/publish_app/catalogs/mba_catalog.py)
// and must stay in sync with django-app/publish_app/tests/fixtures/product_icon_map_keys.json.
export const PRODUCT_ICON_MAP: Record<string, FC<IconProps>> = {
  t_shirt: TShirtIcon,
  t_shirt_premium: TShirtPremiumIcon,
  t_shirt_heavyweight: TShirtHeavyweightIcon,
  v_neck: VNeckIcon,
  tank_top: TankTopIcon,
  long_sleeve: LongSleeveIcon,
  raglan: RaglanIcon,
  sweatshirt: SweatshirtIcon,
  hoodie_pullover: HoodiePulloverIcon,
  hoodie_zip: HoodieZipIcon,
  performance: PerformanceIcon,
  baseball: BaseballIcon,
  trucker_hat: TruckerHatIcon,
  popsocket: PopSocketIcon,
  phone_case: PhoneCaseIcon,
  throw_pillow: ThrowPillowIcon,
  tote_bag: ToteBagIcon,
  tumbler: TumblerIcon,
  mug: MugIcon,
  water_bottle: WaterBottleIcon,
};
