use coc_data::get_full_catalog;

fn main() {
    let cat = get_full_catalog();
    print!("{}", serde_json::to_string(&cat).unwrap());
}
