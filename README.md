# Introduction

A blockchain migration tool for migrating from EVM based chains to Immutable X.

## Installation



## Usage


## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## Immediate to-do
*There's duplicate tokenIDs in the dataset, these are also found in the DB. Before troubleshooting this issue, likely just look to rewrite the loading script to be block by block rather than the current setup.

## Long-term to-do
*Improve the loading of the DB to be based on blocks rather than time or sequential
*Improve the efficiency of the minting requests, they're currently split by unique user addresses but optimally you'd concatenate multiple token arrays with different users into a single batch
*Introduce types for the mint arrays etc.


## License

Not sure yet.