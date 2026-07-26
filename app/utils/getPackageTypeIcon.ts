import { BoxIcon, CoffeeIcon, ContainerIcon, GemIcon, PackageIcon, ShipIcon } from '@lucide/vue';
import type { Component } from 'vue';

import type { PackageType } from '#shared/types/packages';

const PACKAGE_TYPE_ICONS: Record<PackageType, Component> = {
  npm: PackageIcon,
  maven: CoffeeIcon,
  rubygems: GemIcon,
  docker: ShipIcon,
  nuget: BoxIcon,
  container: ContainerIcon,
};

export default function (packageType: PackageType): Component {
  return PACKAGE_TYPE_ICONS[packageType] ?? PackageIcon;
}
