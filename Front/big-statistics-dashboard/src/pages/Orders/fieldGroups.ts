export const FIELD_GROUPS: Record<string, string[]> = {
    'Информация о заказе': [
        'OrderConformDay',
        'OrderDate',
        'OrderShipmentDay_Svod',
        'Order_No',
        'RunOrderDay',
        'ShipmentMonth',
        'ShipmentYear',
        'Delay',
        'ProductionOrder',
    ],
    'Информация о продукте': [
        'Article_number',
        'Displacement',
        'Firmware',
        'GroupName',
        'HeadAndOther',
        'Name_CN',
        'Power',
        'Prod_Group',
    ],
    'Кол-во': [
        'FACT_QTY',
        'Order_QTY',
        'Total_Order_QTY',
        'Uncompleted_QTY',
    ],
}; 