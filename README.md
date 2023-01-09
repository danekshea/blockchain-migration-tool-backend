# Introduction

A blockchain migration tool for migrating from EVM based chains to Immutable X.

## Installation



## Usage


## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## Immediate to-do
*The minting script will create batches but there is a discrepancy between the amount of batches it should be creating and the amount that it does, cross reference the JSON outputted to the files to figure out why.
*There's duplicate tokenIDs in the dataset, these are also found in the DB. Before troubleshooting this issue, likely just look to rewrite the loading script to be block by block rather than the current setup.

## Long-term to-do
*Improve the loading of the DB to be based on blocks rather than time or sequential
*Improve the efficiency of the minting requests, they're currently split by unique user addresses but optimally you'd concatenate multiple token arrays with different users into a single batch


## License

Not sure yet.