use super::*;

use model::{Block, Schedule, TimeBlock};

pub(crate) trait ScheduleExt {
  fn from_selection(selection: &ElementRef) -> Result<Self>
  where
    Self: Sized;
}

impl ScheduleExt for Schedule {
  fn from_selection(selection: &ElementRef) -> Result<Self> {
    let timeblocks = selection.select_many("timeblock")?;

    let term = |ssid: Option<&str>| -> Option<String> {
      match (ssid.map(|ssid| &ssid[4..6]), ssid.map(|ssid| &ssid[0..4])) {
        (Some("01"), Some(year)) => Some(format!("Winter {year}")),
        (Some("05"), Some(year)) => Some(format!("Summer {year}")),
        (Some("09"), Some(year)) => Some(format!("Fall {year}")),
        _ => None,
      }
    };

    Ok(Self {
      blocks: Some(
        selection
          .select_many("block")?
          .into_iter()
          .map(|block| {
            Ok(Block {
              campus: block.value().attr("campus").map(String::from),
              display: block.value().attr("disp").map(String::from),
              location: block.value().attr("location").map(String::from),
              timeblocks: Some(
                timeblocks
                  .iter()
                  .filter(|timeblock| {
                    block
                      .value()
                      .attr("timeblockids")
                      .unwrap_or_default()
                      .split(',')
                      .any(|id| {
                        id == timeblock.value().attr("id").unwrap_or_default()
                      })
                  })
                  .map(|timeblock| TimeBlock {
                    day: timeblock.value().attr("day").map(String::from),
                    t1: timeblock.value().attr("t1").map(String::from),
                    t2: timeblock.value().attr("t2").map(String::from),
                  })
                  .collect(),
              ),
            })
          })
          .collect::<Result<Vec<_>>>()?,
      ),
      term: term(selection.select_single("selection")?.value().attr("ssid")),
    })
  }
}
