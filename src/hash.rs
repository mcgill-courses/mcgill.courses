use super::*;

pub(crate) trait Hash {
  fn hash(&self) -> Result<Vec<u8>>;
}

impl Hash for PathBuf {
  fn hash(&self) -> Result<Vec<u8>> {
    let mut hasher = Sha256::new();

    let read = |path: &PathBuf| -> Result<Vec<u8>> {
      let mut file = File::open(path)?;
      let mut buffer = Vec::new();
      file.read_to_end(&mut buffer)?;
      Ok(buffer)
    };

    match (self.is_dir(), self.is_file()) {
      (true, false) => {
        for entry in WalkDir::new(self)
          .into_iter()
          .filter_map(|e| e.ok())
          .filter(|e| e.file_type().is_file())
        {
          hasher.update(read(&entry.path().to_path_buf())?);
        }
      }
      (false, true) => {
        hasher.update(read(self)?);
      }
      _ => {
        return Err(Error(anyhow!(
          "{} is neither a file nor a directory",
          self.display()
        )));
      }
    }

    Ok(hasher.finalize().to_vec())
  }
}

#[cfg(test)]
mod tests {
  use {super::*, std::io::Write, tempfile::tempdir};

  #[test]
  fn hash_file() {
    let directory = tempdir().unwrap();

    let path = directory.path().join("test.txt");

    let mut file = File::create(&path).unwrap();
    writeln!(file, "Hello, world!").unwrap();

    let hash_a = path.hash().unwrap();
    assert!(!hash_a.is_empty());

    let hash_b = path.hash().unwrap();
    assert!(!hash_b.is_empty());

    assert_eq!(hash_a, hash_b);

    writeln!(file, "yeet").unwrap();

    let hash_c = path.hash().unwrap();

    assert!(!hash_c.is_empty());
    assert_ne!(hash_c, hash_a);

    directory.close().unwrap();
  }

  #[test]
  fn hash_directory() {
    let directory = tempdir().unwrap();

    let path = directory.path().join("test.txt");

    let mut file = File::create(path).unwrap();
    writeln!(file, "Hello, world!").unwrap();

    let hash_a = directory.path().to_path_buf().hash().unwrap();
    assert!(!hash_a.is_empty());

    let hash_b = directory.path().to_path_buf().hash().unwrap();
    assert!(!hash_b.is_empty());

    assert_eq!(hash_a, hash_b);

    writeln!(file, "yeet").unwrap();

    let hash_c = directory.path().to_path_buf().hash().unwrap();

    assert!(!hash_c.is_empty());
    assert_ne!(hash_c, hash_a);

    directory.close().unwrap();
  }

  #[test]
  fn hash_neither_file_nor_directory() {
    let directory = tempdir().unwrap();

    let result = directory.path().join("invalid").hash();

    assert_eq!(
      result.unwrap_err().to_string(),
      format!(
        "{} is neither a file nor a directory",
        directory.path().join("invalid").display()
      )
    );

    directory.close().unwrap();
  }
}
