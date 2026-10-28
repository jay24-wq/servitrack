export interface Village {
    name: string;
    postal: string;
    lat: number;
    lng: number;
}
export interface District {
    name: string;
    villages: Village[];
}
export interface City {
    name: string;
    districts: District[];
}
export declare const PROVINCE: {
    readonly name: "Bali";
    readonly code: "51";
};
export declare const BALI_REGIONS: City[];
//# sourceMappingURL=bali-regions.d.ts.map