export type WatchMovement = 'Automatique' | 'Quartz';

export interface WatchAttributes {
  modele: string;
  reference: string;
  diametre: string;
  boitier: string;
  verre: string;
  fondDeBoite?: string;
  mouvement: WatchMovement;
  reserveDeMarche?: string;
  bracelet: string;
  etancheite?: string;
  cadran?: string;
  minuterie?: string;
  affichage?: string;
  indexAiguilles?: string;
  guichetDate?: string;
  fermoir?: string;
  collection?: string;
  fabrication?: string;
}

export type ProductStatus = 'published' | 'draft';
export type StockStatus = 'En stock' | 'Stock limité' | 'Sur commande' | 'Indisponible';

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary?: boolean;
  type?: 'face' | 'trois-quarts' | 'fond' | 'portee';
}

export interface Product {
  id: string;
  sku: string;
  reference: string;
  brand: 'Tissot' | 'Timex' | 'Maison Heritage' | string;
  name: string;
  slug: string;
  category: 'montres' | 'parfums' | 'lunettes' | string;
  priceXOF: number;
  stockStatus: StockStatus;
  stockCount: number;
  status: ProductStatus;
  primaryImage: string;
  additionalImages: ProductImage[];
  shortDescription: string;
  valueStoryTitle: string;
  valueStoryText: string;
  attributes: WatchAttributes;
  provenanceSummary: string;
  warrantySummary: string;
  deliverySummary: string;
  faq: {
    question: string;
    answer: string;
  }[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | 'pending_payment'
  | 'payment_pending'
  | 'paid'
  | 'processing'
  | 'shipped_or_ready'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'payment_failed';

export interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
  commune: string;
  deliveryAddress: string;
  notes?: string;
  deliveryMode: 'livraison_abidjan' | 'retrait_yopougon';
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  customer: OrderCustomer;
  items: CartItem[];
  subtotalXOF: number;
  deliveryCostXOF: number;
  totalXOF: number;
  paymentMethod?: string;
  paymentReference?: string;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note: string;
  }[];
}

export interface ContactRequest {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  subject: 'Conseil avant achat' | 'Question sur une référence' | 'Suivi de commande' | 'Autre';
  message: string;
  referenceOptIn?: string;
  consent: boolean;
  createdAt: string;
}

export interface FilterState {
  search: string;
  brand: string[];
  category: string[];
  movement: string[];
  diameter: string[];
  waterResistance: string[];
  material: string[];
  dialColor: string[];
  availability: string[];
  minPrice?: number;
  maxPrice?: number;
  pricePreset?: string;
  sort: 'pertinence' | 'prix_croissant' | 'prix_decroissant' | 'nouveautes';
}

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  fullName: string;
  commune?: string;
  deliveryAddress?: string;
  role: 'customer' | 'admin';
  createdAt?: string;
}

